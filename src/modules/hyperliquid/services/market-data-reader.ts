import type {
  Market,
  MarketDataReader,
  OrderbookSnapshot,
  OrderbookUpdate,
  ResyncSignal,
  Side,
  Ticker,
  Trade,
  TradesUpdate,
  Unsubscribe,
  VenueIdentifier,
} from '@/modules/shared/domain'
import type { Result } from 'neverthrow'
import type { Logger } from '@/modules/shared/logger'
import type {
  HyperliquidGateway,
  HyperliquidGatewayError,
} from '../gateway/hyperliquid-gateway.types'
import type {
  L2BookWsEvent,
  MetaAndAssetCtxsResponse,
  PerpAssetCtxSchema,
  SpotAssetCtxSchema,
  SpotMetaAndAssetCtxsResponse,
  TradesWsEvent,
} from '../gateway/sdk-types'
import {
  brandSdkAddress,
  canonicalizeUnitToken,
  computeFundingCountdownSeconds,
  parseStringifiedNumber,
  toDomainPerpSymbol,
  toHlCoin,
  toHlCoinFromMarket,
} from '../hyperliquid.utils'
import { HYPERLIQUID_ZERO_TRANSACTION_HASH } from '../hyperliquid.constants'
import { bucketLevels, inferAutoTick, tickToL2BookAggregation } from './tick-aggregation'
import { withReconnect } from '@/modules/shared/services/with-reconnect'
import type {
  HyperliquidAssetInfo,
  HyperliquidReferencePrice,
} from './hyperliquid-trader.types'

const QUOTE_ASSET = 'USDC'

// HL spot asset ids are offset by 10000 from the spot universe index; perp
// asset ids are the bare (dense) perp universe index. See the HL exchange API.
const SPOT_ASSET_ID_OFFSET = 10_000

// HL builder-deployed perp (HIP-3) asset ids are encoded as
// `100000 + perpDexIndex*10000 + assetIndex`, where `perpDexIndex` is the
// 1-based position of the dex in the `perpDexs()` array (index 0 is the null
// main DEX). The first builder dex's first asset is therefore 110000 — matching
// the SDK's `SymbolConverter.getAssetId('test:ABC') === 110000`. See the HL
// exchange API (asset ids for builder-deployed perps).
const HIP3_ASSET_ID_BASE = 100_000
const PERP_DEX_ASSET_ID_STRIDE = 10_000
const ORDERBOOK_MAX_LEVELS = 20

// Retry the primary perp source on transient errors before giving up. HL's
// HTTP `info` backend occasionally 500s in short bursts (same flakiness the
// candles reader already guards against); a single failed attempt here left
// the entire market list permanently empty since `refresh()` is fire-and-forget
// with no caller-side retry. 3 attempts covers the typical burst.
const HTTP_RETRY_ATTEMPTS = 3
const HTTP_RETRY_BASE_DELAY_MS = 400
const HTTP_RETRY_RATE_LIMIT_DELAY_MS = 1_500

function isRetryableHttp(error: HyperliquidGatewayError): boolean {
  const isNetwork = error.kind === 'network'
  const isRateLimited = error.kind === 'rate-limited'
  return isNetwork || isRateLimited
}

export interface HyperliquidMarketDataReader extends MarketDataReader {
  /** Re-fetch perp universe + per-asset context; updates cached `listMarkets()`. */
  refresh(): Promise<void>
  /**
   * Resolve the HL asset metadata (`assetId`, `szDecimals`, `marketType`) for a
   * display symbol or HL coin key — the trader adapter's `resolveAsset` dep.
   * Built from the same universe projection that drives `listMarkets()` (no
   * second SymbolConverter). Perp asset id is the dense universe index; spot is
   * `10000 + universe.index` (HL's spot asset-id offset); HIP-3 builder perps
   * are `100000 + perpDexIndex*10000 + assetIndex` and are indexed as `'perp'`
   * for tick/format rules. `null` before the first `refresh()` or for an
   * unknown symbol.
   */
  resolveAssetInfo(symbol: string): HyperliquidAssetInfo | null
  /**
   * Current top-of-book / mark reference for a symbol — the trader adapter's
   * `getReferencePrice` dep for deriving a market order's aggressive IOC price.
   * Sourced from the cached `Market.markPrice` (populated by the live ctx
   * stream / refresh). `null` for an unknown symbol or before mark is known.
   */
  getReferencePrice(symbol: string): HyperliquidReferencePrice | null
  /**
   * Latest live mark for a symbol, sourced from the ticker stream (every
   * `subscribeTicker` tick updates this cache). Distinct from the static
   * `Market.markPrice`, which is frozen to the once-per-session `refresh()`.
   * `null` before the first tick lands for the symbol. The venue-owned
   * `previewOrder` reads this so its estimates track the live price (bug #2)
   * without opening a second subscription — it reuses the ticks order-entry's
   * `useLiveMark` already drives. See ADR-0035 D-4.
   */
  getLiveMark(symbol: string): number | null
  /**
   * The display symbol of the most-recently-opened ticker subscription — the
   * venue's notion of the "active" order-ticket market, since `OrderDraft`
   * carries no symbol (ADR-0035 D-1). Order entry continuously subscribes the
   * selected market's ticker (`useLiveMark`), so this reflects that selection.
   * `null` before any ticker subscription.
   */
  getActiveTickerSymbol(): string | null
}

export interface CreateHyperliquidMarketDataReaderOptions {
  readonly gateway: HyperliquidGateway
  readonly venueId: VenueIdentifier
  readonly logger: Logger
  /** Override the retry-backoff timer in tests (defaults to `setTimeout`). */
  readonly setTimeout?: (handler: () => void, ms: number) => unknown
  /** Liveness source forwarded to withReconnect for resume-driven resync (ADR-0041). */
  readonly resyncSignal?: ResyncSignal
}

function projectL2Book(
  event: L2BookWsEvent,
  tick: number,
  sequence: number,
): OrderbookSnapshot {
  const [rawBids, rawAsks] = event.levels
  const bids = bucketLevels(
    rawBids.map((l) => ({ price: Number(l.px), size: Number(l.sz) })),
    tick,
    'bid',
    ORDERBOOK_MAX_LEVELS,
  )
  const asks = bucketLevels(
    rawAsks.map((l) => ({ price: Number(l.px), size: Number(l.sz) })),
    tick,
    'ask',
    ORDERBOOK_MAX_LEVELS,
  )
  return {
    kind: 'snapshot',
    symbol: toDomainPerpSymbol(event.coin),
    sequence,
    bids,
    asks,
    timestamp: event.time,
  }
}

function projectTrade(t: TradesWsEvent[number]): Trade {
  const side: Side = t.side === 'B' ? 'buy' : 'sell'
  // HL emits the all-zero hash for trades with no on-chain transaction (the
  // common case — fills matched off-chain). Treat as absent so the trades-tape
  // hides the explorer link instead of rendering a dead URL.
  const isZeroHash = t.hash === HYPERLIQUID_ZERO_TRANSACTION_HASH
  // HL's `users` tuple is positional `[maker, taker]` — the taker is the
  // aggressor whose `side` labels the trade, the maker is the resting order.
  // The mapping is by tuple position, not re-derived from `side`.
  const hasParticipants = Array.isArray(t.users) && t.users.length === 2
  const makerAddress = hasParticipants ? brandSdkAddress(t.users[0]) : undefined
  const takerAddress = hasParticipants ? brandSdkAddress(t.users[1]) : undefined
  return {
    identifier: String(t.tid),
    symbol: toDomainPerpSymbol(t.coin),
    side,
    price: Number(t.px),
    size: Number(t.sz),
    timestamp: t.time,
    transactionHash: isZeroHash ? undefined : t.hash,
    takerAddress,
    makerAddress,
  }
}

export function createHyperliquidMarketDataReader(
  options: CreateHyperliquidMarketDataReaderOptions,
): HyperliquidMarketDataReader {
  const log = options.logger.child({ module: 'hyperliquid-market-data-reader' })
  const schedule = options.setTimeout ?? ((h, ms) => setTimeout(h, ms))
  let cached: Market[] = []
  const marketListeners = new Set<(markets: Market[]) => void>()
  // Trader asset-info index, keyed by BOTH display symbol and HL coin key so
  // `resolveAsset` matches the same way `resolveMarket` does. Populated by the
  // perp/spot projections during `refresh()`; perp keys never collide with
  // spot keys. Built from the same universe responses as `cached` — no second
  // symbol converter (PRD: reuse the existing market-data plumbing).
  const assetInfoByKey = new Map<string, HyperliquidAssetInfo>()
  // Live-mark cache + active ticker symbol — fed by the `subscribeTicker`
  // fan-out (no extra subscription). Backs the venue-owned `previewOrder`'s
  // live mark + the "active market" resolution for the symbol-less OrderDraft.
  const liveMarkBySymbol = new Map<string, number>()
  let activeTickerSymbol: string | null = null

  function recordLiveMark(symbol: string, markPrice: number): void {
    const isUsableMark = Number.isFinite(markPrice) && markPrice > 0
    if (!isUsableMark) return
    liveMarkBySymbol.set(symbol, markPrice)
  }

  function indexAssetInfo(
    market: Market,
    assetId: number,
    szDecimals: number,
    marketType: 'perp' | 'spot',
  ): void {
    const info: HyperliquidAssetInfo = { assetId, szDecimals, marketType }
    assetInfoByKey.set(market.symbol, info)
    if (market.hlCoin !== undefined) assetInfoByKey.set(market.hlCoin, info)
  }

  /**
   * Fetch the primary perp universe + ctxs, retrying transient
   * network/rate-limit errors with exponential backoff. The perp source is
   * the one whose failure aborts the whole refresh, so it is the only source
   * retried here; spot/HIP-3 already degrade gracefully to `[]`.
   */
  async function fetchPerpWithRetry(): Promise<
    Result<MetaAndAssetCtxsResponse, HyperliquidGatewayError>
  > {
    let last: Result<MetaAndAssetCtxsResponse, HyperliquidGatewayError> | null = null
    for (let attempt = 1; attempt <= HTTP_RETRY_ATTEMPTS; attempt += 1) {
      const res = await options.gateway.getMetaAndAssetCtxs()
      if (res.isOk()) return res
      last = res
      const isLastAttempt = attempt === HTTP_RETRY_ATTEMPTS
      const isRetryable = isRetryableHttp(res.error)
      if (!isRetryable || isLastAttempt) break
      const isRateLimited = res.error.kind === 'rate-limited'
      const delay = isRateLimited
        ? HTTP_RETRY_RATE_LIMIT_DELAY_MS
        : HTTP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
      log.debug({ attempt, kind: res.error.kind, delayMs: delay }, 'refresh retry')
      await new Promise<void>((resolve) => schedule(resolve, delay))
    }
    if (last === null) throw new Error('unreachable: retry loop produced no result')
    return last
  }

  /**
   * Resolve the domain `Market` for a display symbol from the refreshed
   * universe cache. The reader is the single symbol-convention boundary
   * (`MODULE.md` "Symbol convention boundary lives in the readers"); callers
   * pass the display symbol and the reader owns the HL-coin resolution.
   * Returns `undefined` for an unknown symbol (pre-refresh or legacy).
   */
  function resolveMarket(symbol: string): Market | undefined {
    // Trading-side consumers historically pass `market.hlCoin` here (Orderbook,
    // TradesTape) rather than the canonical display symbol. Match against both
    // so downstream lookups (`Market.markPrice` for tick→nSigFigs aggregation)
    // succeed regardless of which key the caller threaded through.
    return cached.find((m) => m.symbol === symbol || m.hlCoin === symbol)
  }

  /**
   * WIRE-03 defect fix: the wire coin is resolved from the resolved
   * `Market.hlCoin` (Phase 2 `toHlCoinFromMarket`) — which understands Spot
   * `@N` and HIP-3 `dex:ASSET` — never the perps-only `toHlCoin(displaySymbol)`
   * strip. Falls back to the `-PERP` strip only when the symbol is not yet in
   * the cache (legacy mock markets / pre-refresh).
   */
  function resolveHlCoin(symbol: string): string {
    const market = resolveMarket(symbol)
    if (market !== undefined) return toHlCoinFromMarket(market)
    return toHlCoin(symbol)
  }

  /**
   * Empty-symbol safety net. If the caller threads an unresolved market
   * (e.g. trade page mounted before the markets cache populates) we MUST NOT
   * forward `coin: ""` to HL — HL rejects with "Invalid subscription" and
   * closes the **shared** WebSocketTransport, which takes out every sister
   * stream subscribed on it. Cleanest at the seam: refuse the subscribe and
   * return a no-op. Components also skip subscribes for undefined symbols,
   * but this is the gateway-side belt-and-braces. See plan
   * `enchanted-bubbling-hopcroft.md` (Bug A).
   */
  function guardedHlCoin(symbol: string, channel: string): string | null {
    const resolved = resolveHlCoin(symbol)
    if (symbol === '' || resolved === '') {
      log.warn({ symbol, channel }, 'subscribe skipped: unresolved symbol')
      return null
    }
    return resolved
  }

  const NOOP_UNSUBSCRIBE: Unsubscribe = () => {}

  function enrichWithCtx(
    market: Market,
    ctx: { markPx?: string; prevDayPx?: string; dayNtlVlm?: string } | undefined,
  ): void {
    if (ctx === undefined) return
    const markPrice = Number(ctx.markPx)
    const prevDay = Number(ctx.prevDayPx)
    const volume24h = Number(ctx.dayNtlVlm)
    if (Number.isFinite(markPrice)) market.markPrice = markPrice
    if (Number.isFinite(volume24h)) market.volume24h = volume24h
    const hasValidPrevDay =
      Number.isFinite(markPrice) && Number.isFinite(prevDay) && prevDay > 0
    if (hasValidPrevDay) market.change24hPct = (markPrice - prevDay) / prevDay
  }

  function projectPerp(response: MetaAndAssetCtxsResponse): Market[] {
    const [meta, ctxs] = response
    const markets: Market[] = []
    for (let i = 0; i < meta.universe.length; i++) {
      const u = meta.universe[i]
      if (u.isDelisted) continue
      const market: Market = {
        symbol: toDomainPerpSymbol(u.name),
        baseAsset: u.name,
        quoteAsset: QUOTE_ASSET,
        venue: options.venueId,
        tickSize: 0,
        stepSize: 10 ** -u.szDecimals,
        marketType: 'perp',
        hlCoin: u.name,
        hasCandles: true,
        maxLeverage: u.maxLeverage,
      }
      enrichWithCtx(market, ctxs[i] as Parameters<typeof enrichWithCtx>[1])
      // Perp asset id is the dense universe index.
      indexAssetInfo(market, i, u.szDecimals, 'perp')
      markets.push(market)
    }
    return markets
  }

  /**
   * Resolve a spot universe entry's `BASE/QUOTE` display pair. HL's spot
   * `universe[i].name` is `@N` for every pair except the canonical PURR/USDC,
   * so the human pair is reconstructed from the token table:
   * `universe[i].tokens[0/1]` → `tokens[idx].name` (same join `buildSpotPriceIndex`
   * uses). When `name` already carries a slash (canonical pair, or a test
   * fixture) it is taken as-is. Returns `undefined` when the pair cannot be
   * resolved (unknown token index) — the caller drops it.
   */
  function resolveSpotPair(
    u: SpotMetaAndAssetCtxsResponse[0]['universe'][number],
    tokenNameByIndex: Map<number, string>,
  ): { base: string; quote: string } | undefined {
    const isHumanPairName = u.name.includes('/')
    if (isHumanPairName) {
      const [base, quote] = u.name.split('/')
      if (base === undefined || quote === undefined) return undefined
      return { base, quote }
    }
    const baseIdx = u.tokens?.[0]
    const quoteIdx = u.tokens?.[1]
    if (baseIdx === undefined || quoteIdx === undefined) return undefined
    const base = tokenNameByIndex.get(baseIdx)
    const quote = tokenNameByIndex.get(quoteIdx)
    if (base === undefined || quote === undefined) return undefined
    return { base, quote }
  }

  function projectSpot(response: SpotMetaAndAssetCtxsResponse): Market[] {
    const [spotMeta, spotCtxs] = response
    const tokenNameByIndex = new Map<number, string>()
    const tokenSzDecimalsByIndex = new Map<number, number>()
    for (const t of spotMeta.tokens ?? []) {
      tokenNameByIndex.set(t.index, t.name)
      tokenSzDecimalsByIndex.set(t.index, t.szDecimals)
    }
    // HL's spot `universe` array is not dense (`universe[i].index !== i` for
    // most entries) and the assetCtxs array does not align by array position.
    // The reliable join is `ctx.coin === universe[i].name` (`@107`, or the
    // literal `PURR/USDC` for the canonical pair). The SDK's public ctx type
    // does not surface `coin`, so the key read goes through the same boundary
    // cast `enrichWithCtx` already uses. See ADR-0017.
    const ctxByCoin = new Map<string, (typeof spotCtxs)[number]>()
    for (const c of spotCtxs) {
      const coin = (c as { coin?: string }).coin
      if (coin !== undefined) ctxByCoin.set(coin, c)
    }
    // Dedupe by canonical symbol. Some Hyperliquid base assets list both a
    // native pair (`PUMP/USDC`) and a Unit-bridged pair (`UPUMP/USDC`) as
    // separate universe entries. After `canonicalizeUnitToken` collapses
    // `UPUMP → PUMP`, both project to the same `symbol`, which surfaces as a
    // React duplicate-key warning and a double-rendered row. Policy: the
    // native (non-bridged) entry wins; the Unit-bridged collapse is only
    // emitted when no native counterpart exists (ADR-0018's original case,
    // e.g. there is no native `BTC/USDC` so `UBTC/USDC` becomes `BTC/USDC`).
    type SpotProjection = { market: Market; isUnitBridged: boolean }
    const bySymbol = new Map<string, SpotProjection>()
    for (let i = 0; i < spotMeta.universe.length; i++) {
      const u = spotMeta.universe[i]
      const isDelisted = (u as { isDelisted?: true }).isDelisted === true
      if (isDelisted) continue
      const pair = resolveSpotPair(u, tokenNameByIndex)
      if (pair === undefined) continue
      // Canonicalize Unit-bridged base tokens (UBTC → BTC) at this single
      // symbol-convention boundary so the canonical name propagates to the
      // display symbol, baseAsset, URL/favorites key, and icon URL. The
      // `hlCoin` and the `ctxByCoin` join key are both the raw HL universe
      // name and are deliberately left un-canonicalized. See ADR-0018.
      const base = canonicalizeUnitToken(pair.base)
      const isUnitBridged = base !== pair.base
      const market: Market = {
        symbol: `${base}/${pair.quote}`,
        baseAsset: base,
        quoteAsset: pair.quote,
        venue: options.venueId,
        tickSize: 0,
        stepSize: 0,
        marketType: 'spot',
        // The HL coin key is the universe entry's `name`, NOT `@${u.index}`.
        // For every pair except the canonical PURR/USDC these coincide
        // (`name === "@<index>"`), so the old `@${u.index}` reconstruction
        // worked — but PURR/USDC's `name` is the literal pair string, and
        // `@${u.index}` produced a coin HL rejects, so its candles, trades,
        // and orderbook all came back empty. Using `name` fixes the canonical
        // pair and stays correct for the rest. See ADR-0017.
        hlCoin: u.name,
        hasCandles: true,
      }
      enrichWithCtx(market, ctxByCoin.get(u.name) as Parameters<typeof enrichWithCtx>[1])
      // Spot order size decimals come from the base token, not the universe
      // entry; spot asset id is offset by 10000 from the spot universe index.
      const baseTokenIndex = u.tokens?.[0]
      const baseSzDecimals =
        baseTokenIndex === undefined ? undefined : tokenSzDecimalsByIndex.get(baseTokenIndex)

      const existing = bySymbol.get(market.symbol)
      const isFirstSeen = existing === undefined
      const isNativeReplacingBridged =
        existing !== undefined && existing.isUnitBridged && !isUnitBridged
      const isWinningProjection = isFirstSeen || isNativeReplacingBridged
      if (!isWinningProjection) continue
      bySymbol.set(market.symbol, { market, isUnitBridged })
      if (baseSzDecimals !== undefined) {
        indexAssetInfo(market, SPOT_ASSET_ID_OFFSET + u.index, baseSzDecimals, 'spot')
      }
    }
    return Array.from(bySymbol.values(), (entry) => entry.market)
  }

  /**
   * Project a single HIP-3 dex's `metaAndAssetCtxs` response into domain
   * markets. Unlike spot, perp universes (including builder-deployed ones)
   * are dense — `ctxs[i]` aligns with `meta.universe[i]` — so the join is
   * by index. The dex's universe names may already be dex-qualified
   * (`xyz:XYZ100`) or bare (`TSLA` in some tests); we normalise both.
   */
  function projectHip3Dex(
    dexIndex: number,
    dexName: string,
    response: MetaAndAssetCtxsResponse,
  ): Market[] {
    const [meta, ctxs] = response
    const markets: Market[] = []
    for (let i = 0; i < meta.universe.length; i++) {
      const u = meta.universe[i]
      if (u.isDelisted) continue
      const isDexQualified = u.name.includes(':')
      const hlCoin = isDexQualified ? u.name : `${dexName}:${u.name}`
      const assetSegment = hlCoin.slice(hlCoin.indexOf(':') + 1)
      const market: Market = {
        symbol: hlCoin,
        baseAsset: assetSegment,
        quoteAsset: QUOTE_ASSET,
        venue: options.venueId,
        tickSize: 0,
        stepSize: 10 ** -u.szDecimals,
        marketType: 'hip3',
        hlCoin,
        hasCandles: true,
        maxLeverage: u.maxLeverage,
      }
      enrichWithCtx(market, ctxs[i] as Parameters<typeof enrichWithCtx>[1])
      // Builder-perp asset id is dex-offset-derived (not the dense universe
      // index); index it as a 'perp' so the trader signs the right asset and
      // `formatPrice` applies perp tick rules. See `HIP3_ASSET_ID_BASE`.
      const assetId = HIP3_ASSET_ID_BASE + dexIndex * PERP_DEX_ASSET_ID_STRIDE + i
      indexAssetInfo(market, assetId, u.szDecimals, 'perp')
      markets.push(market)
    }
    return markets
  }

  // Spot markets are removed from this client (PRD-0008 D14). We filter them out
  // at the venue boundary — the public `listMarkets()` / `subscribeMarkets()`
  // surface the market-selection UI reads — while leaving the internal `cached`
  // universe intact so symbol/asset resolution stays correct. `hip3` IS a perp
  // and stays.
  const excludeSpot = (markets: Market[]): Market[] =>
    markets.filter((m) => m.marketType !== 'spot')

  return {
    listMarkets(): Market[] {
      return excludeSpot(cached)
    },
    resolveAssetInfo(symbol: string): HyperliquidAssetInfo | null {
      return assetInfoByKey.get(symbol) ?? null
    },
    getReferencePrice(symbol: string): HyperliquidReferencePrice | null {
      const market = resolveMarket(symbol)
      if (market === undefined) return null
      const hasMark = market.markPrice !== undefined && market.markPrice > 0
      if (!hasMark) return null
      // Top-of-book is sourced from the live orderbook stream at the consumer;
      // the reader surfaces the cached mark as the IOC reference. The trader's
      // `deriveMarketReferencePrice` falls back to mark when book sides are
      // absent, so a mark-only reference is sufficient for the simulated
      // market order (PRD decision 9).
      return { mark: market.markPrice }
    },
    getLiveMark(symbol: string): number | null {
      return liveMarkBySymbol.get(symbol) ?? null
    },
    getActiveTickerSymbol(): string | null {
      return activeTickerSymbol
    },
    subscribeMarkets(onChange: (markets: Market[]) => void): Unsubscribe {
      const listener = (markets: Market[]): void => onChange(excludeSpot(markets))
      marketListeners.add(listener)
      onChange(excludeSpot(cached))
      return () => {
        marketListeners.delete(listener)
      }
    },
    subscribeOrderbook(
      symbol: string,
      onUpdate: (update: OrderbookUpdate) => void,
      opts?: { tick?: number },
    ): Unsubscribe {
      const resolved = guardedHlCoin(symbol, 'l2Book')
      if (resolved === null) return NOOP_UNSUBSCRIBE
      const hlCoin: string = resolved
      let sequence = 0
      const userTick = opts?.tick ?? 0

      let currentAgg: ReturnType<typeof tickToL2BookAggregation> = undefined
      let currentHandle: ReturnType<typeof withReconnect> | undefined

      function aggregationFor(): ReturnType<typeof tickToL2BookAggregation> {
        const market = resolveMarket(symbol)
        return tickToL2BookAggregation(userTick, market?.markPrice ?? 0)
      }

      function aggregationsEqual(
        a: ReturnType<typeof tickToL2BookAggregation>,
        b: ReturnType<typeof tickToL2BookAggregation>,
      ): boolean {
        if (a === undefined && b === undefined) return true
        if (a === undefined || b === undefined) return false
        return a.nSigFigs === b.nSigFigs
      }

      function openWithAggregation(
        aggregation: ReturnType<typeof tickToL2BookAggregation>,
      ): ReturnType<typeof withReconnect> {
        // When HL aggregates server-side, returned levels are already at the
        // display precision — no need to re-bucket client-side.
        const projectTick = aggregation === undefined ? inferAutoTick() : 0
        return withReconnect({
          subscribe: () =>
            options.gateway.subscribeL2Book(
              hlCoin,
              (event) => {
                sequence += 1
                onUpdate(projectL2Book(event, projectTick, sequence))
              },
              aggregation,
            ),
          logger: log,
          logContext: { symbol },
          event: 'l2Book subscribe',
          resyncSignal: options.resyncSignal,
        })
      }

      currentAgg = aggregationFor()
      currentHandle = openWithAggregation(currentAgg)

      // markPrice may be 0 at subscribe time (markets cache not yet populated
      // — the venue's `refresh()` is async and runs in parallel with the
      // first subscription). Watch the market cache and re-open the L2 sub
      // once the price arrives so the tick→nSigFigs mapping kicks in.
      let unsubMarkets: (() => void) | undefined
      const needsUpgrade = userTick > 0 && currentAgg === undefined
      if (needsUpgrade) {
        const onMarkets = (markets: Market[]) => {
          const m = markets.find((m) => m.symbol === symbol || m.hlCoin === symbol)
          const nextAgg = tickToL2BookAggregation(userTick, m?.markPrice ?? 0)
          if (aggregationsEqual(nextAgg, currentAgg)) return
          currentAgg = nextAgg
          currentHandle?.unsubscribe()
          currentHandle = openWithAggregation(nextAgg)
          // One-shot: once we've upgraded, stop watching (price changes within
          // the same nSigFigs bucket don't require another resubscribe).
          marketListeners.delete(onMarkets)
          unsubMarkets = undefined
        }
        marketListeners.add(onMarkets)
        unsubMarkets = () => marketListeners.delete(onMarkets)
      }

      return () => {
        unsubMarkets?.()
        currentHandle?.unsubscribe()
      }
    },
    subscribeTrades(symbol: string, onUpdate: (update: TradesUpdate) => void): Unsubscribe {
      const resolved = guardedHlCoin(symbol, 'trades')
      if (resolved === null) return NOOP_UNSUBSCRIBE
      const hlCoin: string = resolved
      const handle = withReconnect({
        // `isFirstBatch` is scoped to the subscribe thunk, so each (re)connect's
        // initial HL recent-trades batch becomes a fresh `snapshot` that re-syncs
        // the tape, while live batches stream as `append`. See ADR-0030.
        subscribe: () => {
          let isFirstBatch = true
          return options.gateway.subscribeTradesStream(hlCoin, (events) => {
            const trades = events.map(projectTrade)
            if (isFirstBatch) {
              isFirstBatch = false
              onUpdate({ kind: 'snapshot', trades })
              return
            }
            for (const trade of trades) onUpdate({ kind: 'append', trade })
          })
        },
        logger: log,
        logContext: { symbol },
        event: 'trades subscribe',
        resyncSignal: options.resyncSignal,
      })
      return handle.unsubscribe
    },
    subscribeTicker(symbol: string, onTicker: (ticker: Ticker) => void): Unsubscribe {
      const resolved = guardedHlCoin(symbol, 'activeAssetCtx')
      if (resolved === null) return NOOP_UNSUBSCRIBE
      const hlCoin: string = resolved
      const market = resolveMarket(symbol)
      const isSpot = market?.marketType === 'spot'
      // The most-recent ticker subscription is the venue's active order-ticket
      // market (the symbol-less OrderDraft is priced against it).
      activeTickerSymbol = symbol

      // Spot path: HL spot ctx structurally lacks oracle/funding/OI, so the
      // projection emits a SpotTicker (no perp-only fields) and runs no
      // funding-countdown timer (spot has no funding epoch). Reuses
      // `withReconnect` exactly like the perp ctx path (same reliability
      // profile — RESEARCH.md "Don't Hand-Roll").
      if (isSpot) {
        const emitSpotTicker = (ctx: SpotAssetCtxSchema): void => {
          const markPrice = parseStringifiedNumber(ctx.markPx)
          recordLiveMark(symbol, markPrice)
          onTicker({
            symbol,
            marketType: 'spot',
            markPrice,
            open24h: parseStringifiedNumber(ctx.prevDayPx),
            high24h: 0,
            low24h: 0,
            timestamp: Date.now(),
          })
        }
        const spotHandle = withReconnect({
          subscribe: () =>
            options.gateway.subscribeActiveSpotAssetCtx(hlCoin, (event) => {
              emitSpotTicker(event.ctx)
            }),
          logger: log,
          logContext: { symbol },
          event: 'activeSpotAssetCtx subscribe',
          resyncSignal: options.resyncSignal,
        })
        return spotHandle.unsubscribe
      }

      // Perp / HIP-3 path: oracle/funding/OI present; emits a PerpTicker and
      // ticks a 1-second funding countdown.
      let countdownTimer: ReturnType<typeof setInterval> | null = null
      let latestCtx: PerpAssetCtxSchema | null = null

      function emitTicker(ctx: PerpAssetCtxSchema): void {
        recordLiveMark(symbol, Number(ctx.markPx))
        const ticker: Ticker = {
          symbol,
          marketType: market?.marketType === 'hip3' ? 'hip3' : 'perp',
          markPrice: Number(ctx.markPx),
          indexPrice: Number(ctx.oraclePx),
          openInterest: Number(ctx.openInterest),
          fundingRate: Number(ctx.funding),
          fundingCountdownSeconds: computeFundingCountdownSeconds(),
          open24h: Number(ctx.prevDayPx),
          high24h: 0,
          low24h: 0,
          timestamp: Date.now(),
        }
        onTicker(ticker)
      }

      const handle = withReconnect({
        subscribe: () =>
          options.gateway.subscribeActiveAssetCtx(hlCoin, (event) => {
            latestCtx = event.ctx
            emitTicker(event.ctx)
          }),
        logger: log,
        logContext: { symbol },
        event: 'activeAssetCtx subscribe',
        resyncSignal: options.resyncSignal,
      })

      // 1-second interval keeps the funding countdown ticking down
      countdownTimer = setInterval(() => {
        if (latestCtx !== null) emitTicker(latestCtx)
      }, 1000)

      return () => {
        handle.unsubscribe()
        if (countdownTimer !== null) clearInterval(countdownTimer)
      }
    },
    /**
     * Progressive refresh: perps are the primary universe and gate nothing.
     * They are projected and emitted to subscribers as soon as they resolve
     * (~2-3s), then spot and HIP-3 are folded in independently as each settles.
     * A degraded secondary source (e.g. a 10s `spotMetaAndAssetCtxs` timeout)
     * therefore never blocks the perp list from rendering. `refresh()` itself
     * still awaits every source before resolving, so `await refresh()` callers
     * (tests, cadence refreshers) observe the fully assembled cache.
     */
    async refresh(): Promise<void> {
      // Rebuild the asset-info index from scratch each refresh so a delisted
      // asset does not linger as a resolvable order target.
      assetInfoByKey.clear()
      const perpsResult = await fetchPerpWithRetry()
      if (perpsResult.isErr()) {
        log.warn(
          { kind: perpsResult.error.kind, errorMessage: perpsResult.error.message },
          'refresh failed',
        )
        return
      }
      const perps = projectPerp(perpsResult.value)

      // Latest projected secondary slices; emit() always reassembles in the
      // canonical [...perps, ...spots, ...hip3s] order regardless of which
      // secondary source settled first.
      let spots: Market[] = []
      let hip3s: Market[] = []
      const emit = (): void => {
        cached = [...perps, ...spots, ...hip3s]
        log.debug({ count: cached.length }, 'refresh ok')
        for (const listener of marketListeners) listener(cached)
      }
      emit()

      const applySpot = async (): Promise<void> => {
        const spotResult = await options.gateway.getSpotMetaAndAssetCtxs()
        if (spotResult.isErr()) {
          log.warn(
            { kind: spotResult.error.kind, errorMessage: spotResult.error.message },
            'spot source degraded',
          )
          return
        }
        spots = projectSpot(spotResult.value)
        emit()
      }

      const applyHip3 = async (): Promise<void> => {
        const dexsResult = await options.gateway.getPerpDexs()
        if (dexsResult.isErr()) {
          log.warn({ source: 'hip3' }, 'hip3 source degraded')
          return
        }
        // null entry = main HL DEX (skipped); every other entry is a
        // HIP-3 dex we fetch per-dex ctxs for. Each per-dex result is
        // independent — one dex failing does not blank the rest. The dex's
        // ORIGINAL index in `perpDexs()` is preserved: it drives the
        // builder-perp asset-id encoding (`HIP3_ASSET_ID_BASE`), so it must not
        // collapse to a dense filtered position.
        const dexs: Array<{ index: number; name: string }> = []
        for (let i = 0; i < dexsResult.value.length; i++) {
          const dex = dexsResult.value[i]
          if (dex !== null) dexs.push({ index: i, name: dex.name })
        }
        const isNoHip3Dex = dexs.length === 0
        if (isNoHip3Dex) return

        const settled = await Promise.allSettled(
          dexs.map((dex) => options.gateway.getPerpMetaAndAssetCtxs(dex.name)),
        )

        const next: Market[] = []
        for (let i = 0; i < settled.length; i++) {
          const outcome = settled[i]
          const dex = dexs[i]
          const isRejected = outcome.status === 'rejected'
          if (isRejected) {
            log.warn(
              { source: 'hip3', dex: dex.name, errorMessage: String(outcome.reason) },
              'hip3 dex source degraded',
            )
            continue
          }
          const result = outcome.value
          if (result.isErr()) {
            log.warn(
              { source: 'hip3', dex: dex.name, kind: result.error.kind },
              'hip3 dex source degraded',
            )
            continue
          }
          next.push(...projectHip3Dex(dex.index, dex.name, result.value))
        }
        hip3s = next
        emit()
      }

      await Promise.allSettled([applySpot(), applyHip3()])
    },
  }
}
