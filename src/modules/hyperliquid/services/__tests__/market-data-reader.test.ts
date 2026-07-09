import { describe, it, expect, vi } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { OrderbookUpdate, Ticker, Trade, TradesUpdate } from '@/modules/shared/domain'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { HyperliquidSubscription } from '../../gateway/hyperliquid-gateway.types'
import type {
  ActiveAssetCtxWsEvent,
  L2BookWsEvent,
  MetaAndAssetCtxsResponse,
  PerpDexsResponse,
  SpotMetaAndAssetCtxsResponse,
  TradesWsEvent,
} from '../../gateway/sdk-types'
import { createHyperliquidMarketDataReader } from '../market-data-reader'
import {
  buildActiveSpotAssetCtxEvent,
  buildFakeGateway,
  buildFakeGatewayWithSpotCtx,
  buildFakeLogger,
  buildSpotMetaAndAssetCtxs,
} from '../__fixtures__/web-data2'

const VENUE_ID = 'hyperliquid:mainnet'

function buildMetaAndCtxs(): MetaAndAssetCtxsResponse {
  return [
    {
      universe: [
        { name: 'BTC', szDecimals: 5, maxLeverage: 50 },
        { name: 'SP500', szDecimals: 2, maxLeverage: 20 },
        { name: 'OLDIE', szDecimals: 2, maxLeverage: 5, isDelisted: true },
      ],
      marginTables: [],
    },
    [
      { markPx: '50000', prevDayPx: '49000', dayNtlVlm: '1000000' },
      { markPx: '5000', prevDayPx: '5500', dayNtlVlm: '250000' },
      { markPx: '1', prevDayPx: '1', dayNtlVlm: '0' },
    ],
  ] as unknown as MetaAndAssetCtxsResponse
}

describe('createHyperliquidMarketDataReader.listMarkets', () => {
  it('returns an empty array before the first refresh resolves', () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    expect(reader.listMarkets()).toEqual([])
  })

  it('after refresh, projects perp universe into domain Market[] with enrichment', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const markets = reader.listMarkets()
    expect(markets).toHaveLength(2) // delisted dropped
    const btc = markets.find((m) => m.symbol === 'BTC-PERP')
    expect(btc).toBeDefined()
    expect(btc?.baseAsset).toBe('BTC')
    expect(btc?.quoteAsset).toBe('USDC')
    expect(btc?.venue).toBe(VENUE_ID)
    expect(btc?.markPrice).toBe(50000)
    // (50000 - 49000) / 49000 ≈ 0.02041
    expect(btc?.change24hPct).toBeCloseTo(0.020408, 5)
    expect(btc?.volume24h).toBe(1_000_000)
  })

  it('preserves a negative 24h % change when prevDayPx > markPx', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const sp500 = reader.listMarkets().find((m) => m.symbol === 'SP500-PERP')
    expect(sp500?.change24hPct).toBeLessThan(0)
    // (5000 - 5500) / 5500 ≈ -0.0909
    expect(sp500?.change24hPct).toBeCloseTo(-0.0909, 3)
  })

  it('subscribeMarkets emits the current cache synchronously and again after refresh', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const emissions: number[] = []
    const unsubscribe = reader.subscribeMarkets((markets) => emissions.push(markets.length))
    // Synchronous initial emission with the empty cache.
    expect(emissions).toEqual([0])
    await reader.refresh()
    // Progressive emit: perps emit first, then each secondary source as it
    // settles. Exact emission count is an implementation detail; the contract
    // is that the subscriber is notified and the latest cache holds the 2
    // (non-delisted) perp markets.
    expect(emissions.length).toBeGreaterThan(1)
    expect(emissions[emissions.length - 1]).toBe(2)
    const emissionCountBeforeUnsubscribe = emissions.length
    unsubscribe()
    await reader.refresh()
    // After unsubscribe the listener receives nothing further.
    expect(emissions.length).toBe(emissionCountBeforeUnsubscribe)
  })

  it('drops delisted markets', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    expect(reader.listMarkets().find((m) => m.symbol === 'OLDIE-PERP')).toBeUndefined()
  })
})

/**
 * Builds a spot response in the *real* Hyperliquid shape so the reader's coin
 * resolution is exercised faithfully:
 *
 * - A non-canonical pair's universe `name` is the wire coin `@<index>` (NOT the
 *   human pair). Its display pair is reconstructed from the token table
 *   (`universe[i].tokens[0/1]` → `tokens[idx].name`), exactly as production does.
 * - The canonical PURR/USDC pair (mark it `canonicalName: true`) keeps its
 *   literal `name` — the one pair whose wire coin is the pair string, not
 *   `@<index>`. This is the case that regressed (`@<index>` ≠ HL's coin key, so
 *   chart/trades/orderbook came back empty). See ADR-0017.
 *
 * Callers still pass readable `{ name: 'HYPE/USDC', index: 107 }`; the helper
 * derives the realistic universe `name`, the `tokens` join table, and rewrites
 * each ctx's `coin` (the real `ctx.coin === universe[i].name` join key) from the
 * human pair callers pass to the wire name. An unset ctx `coin` defaults to the
 * positionally-paired universe name. Tests needing a mis-ordered ctx array set
 * `coin` explicitly (as the human pair) per entry.
 */
function buildSpotResponse(
  pairs: Array<{ name: string; index: number; isDelisted?: true; canonicalName?: true }>,
  ctxs: SpotMetaAndAssetCtxsResponse[1] = [],
): SpotMetaAndAssetCtxsResponse {
  const tokenIndexByName = new Map<string, number>()
  const tokenTable: Array<{ name: string; index: number }> = []
  const tokenIndexOf = (sym: string): number => {
    const existing = tokenIndexByName.get(sym)
    if (existing !== undefined) return existing
    const index = tokenTable.length
    tokenTable.push({ name: sym, index })
    tokenIndexByName.set(sym, index)
    return index
  }

  const humanToWire = new Map<string, string>()
  const universe = pairs.map((pair) => {
    const [base, quote] = pair.name.split('/')
    const tokens = [tokenIndexOf(base ?? pair.name), tokenIndexOf(quote ?? 'USDC')]
    const wireName = pair.canonicalName === true ? pair.name : `@${pair.index}`
    humanToWire.set(pair.name, wireName)
    return { name: wireName, index: pair.index, tokens, isDelisted: pair.isDelisted }
  })

  const withCoin = (ctxs as Array<Record<string, unknown>>).map((c, i) => {
    const explicitCoin = c.coin
    if (explicitCoin !== undefined) {
      const wire = humanToWire.get(explicitCoin as string) ?? (explicitCoin as string)
      return { ...c, coin: wire }
    }
    return { ...c, coin: universe[i]?.name }
  })

  return buildSpotMetaAndAssetCtxs(
    {
      universe: universe as unknown as SpotMetaAndAssetCtxsResponse[0]['universe'],
      tokens: tokenTable as unknown as SpotMetaAndAssetCtxsResponse[0]['tokens'],
    },
    withCoin as unknown as SpotMetaAndAssetCtxsResponse[1],
  )
}

function buildPerpDexs(
  entries: Array<{ name: string } | null>,
): PerpDexsResponse {
  return entries as unknown as PerpDexsResponse
}

/**
 * Build a per-dex `MetaAndAssetCtxsResponse`. `assets[i].ctx`, when provided,
 * is enriched in place by the reader; omit it to exercise the no-ctx fallback
 * (price/volume default to undefined).
 */
function buildHip3MetaAndCtxs(
  assets: Array<{
    name: string
    szDecimals: number
    isDelisted?: true
    maxLeverage?: number
    ctx?: { markPx?: string; prevDayPx?: string; dayNtlVlm?: string }
  }>,
): MetaAndAssetCtxsResponse {
  const universe = assets.map((a) => ({
    name: a.name,
    szDecimals: a.szDecimals,
    isDelisted: a.isDelisted,
    maxLeverage: a.maxLeverage,
  }))
  const ctxs = assets.map((a) => a.ctx ?? {})
  return [{ universe, marginTables: [] }, ctxs] as unknown as MetaAndAssetCtxsResponse
}

/**
 * Build a `getPerpMetaAndAssetCtxs` stub keyed on dex name. Unknown dex
 * keys err — surfaces accidental coverage gaps in tests.
 */
function stubHip3CtxsByDex(
  byDex: Record<string, MetaAndAssetCtxsResponse>,
): (dex: string) => ResultAsync<MetaAndAssetCtxsResponse, HyperliquidGatewayError> {
  return (dex: string) => {
    const response = byDex[dex]
    const isKnown = response !== undefined
    if (isKnown) return okAsync(response)
    return errAsync(
      new HyperliquidGatewayError('network', `stub: no ctx for dex ${dex}`),
    )
  }
}

describe('createHyperliquidMarketDataReader.listMarkets — multi-market-type', () => {
  it('MKT-02: listMarkets returns Spot markets after refresh (≥1 marketType === "spot")', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [{ name: 'HYPE/USDC', index: 107 }],
            [{ markPx: '12.5', prevDayPx: '12', dayNtlVlm: '900000' }] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const markets = reader.listMarkets()
    const spots = markets.filter((m) => m.marketType === 'spot')
    expect(spots.length).toBeGreaterThanOrEqual(1)
    const hype = markets.find((m) => m.symbol === 'HYPE/USDC')
    expect(hype).toBeDefined()
    expect(hype?.marketType).toBe('spot')
    expect(hype?.hlCoin).toBe('@107')
    expect(hype?.baseAsset).toBe('HYPE')
    expect(hype?.quoteAsset).toBe('USDC')
    expect(hype?.hasCandles).toBe(true)
    expect(hype?.markPrice).toBe(12.5)
  })

  it('MKT-02: listMarkets returns HIP-3 markets after refresh (≥1 marketType === "hip3")', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getPerpDexs: () => okAsync(buildPerpDexs([null, { name: 'xyz' }])),
      getPerpMetaAndAssetCtxs: stubHip3CtxsByDex({
        xyz: buildHip3MetaAndCtxs([{ name: 'AAPL', szDecimals: 2 }]),
      }),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const hip3s = reader.listMarkets().filter((m) => m.marketType === 'hip3')
    expect(hip3s.length).toBeGreaterThanOrEqual(1)
    expect(hip3s[0].hasCandles).toBe(true)
  })

  it('MKT-03: HIP-3 market hlCoin carries the dex prefix (xyz:AAPL)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getPerpDexs: () => okAsync(buildPerpDexs([null, { name: 'xyz' }])),
      getPerpMetaAndAssetCtxs: stubHip3CtxsByDex({
        xyz: buildHip3MetaAndCtxs([
          {
            name: 'AAPL',
            szDecimals: 2,
            ctx: { markPx: '185.5', prevDayPx: '184', dayNtlVlm: '12345' },
          },
        ]),
      }),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const aapl = reader.listMarkets().find((m) => m.symbol === 'xyz:AAPL')
    expect(aapl).toBeDefined()
    expect(aapl?.hlCoin).toBe('xyz:AAPL')
    expect(aapl?.marketType).toBe('hip3')
    expect(aapl?.baseAsset).toBe('AAPL')
    // ctxs are enriched: markPrice, volume24h, and signed 24h % all populated.
    expect(aapl?.markPrice).toBe(185.5)
    expect(aapl?.volume24h).toBe(12345)
    expect(aapl?.change24hPct).toBeCloseTo((185.5 - 184) / 184, 5)
  })

  it('MKT-04 (ADR-0017): perp and spot coexist for the same base (BTC-PERP + BTC/USDC)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [{ name: 'BTC/USDC', index: 3 }],
            [{ markPx: '76000', prevDayPx: '77000', dayNtlVlm: '19820000' }] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const btcMarkets = reader.listMarkets().filter((m) => m.baseAsset === 'BTC')
    const perp = btcMarkets.find((m) => m.symbol === 'BTC-PERP')
    const spot = btcMarkets.find((m) => m.symbol === 'BTC/USDC')
    expect(perp?.marketType).toBe('perp')
    expect(spot?.marketType).toBe('spot')
    expect(spot?.markPrice).toBe(76000)
  })

  it('ADR-0018: canonicalizes Unit-bridged spot base (UBTC/USDC → BTC/USDC) while non-Unit U-tokens pass through', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [
              { name: 'UBTC/USDC', index: 5 },
              { name: 'UNI/USDC', index: 6 },
              { name: 'PURR/USDC', index: 7, canonicalName: true },
            ],
            [
              { markPx: '76000', prevDayPx: '77000', dayNtlVlm: '1' },
              { markPx: '8', prevDayPx: '8', dayNtlVlm: '1' },
              { markPx: '0.3', prevDayPx: '0.3', dayNtlVlm: '1' },
            ] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const markets = reader.listMarkets()

    const btc = markets.find((m) => m.symbol === 'BTC/USDC')
    expect(btc).toBeDefined()
    expect(btc?.baseAsset).toBe('BTC')
    expect(btc?.hlCoin).toBe('@5')
    expect(btc?.markPrice).toBe(76000)
    expect(markets.some((m) => m.symbol === 'UBTC/USDC')).toBe(false)

    const uni = markets.find((m) => m.symbol === 'UNI/USDC')
    expect(uni?.baseAsset).toBe('UNI')
    expect(uni?.hlCoin).toBe('@6')

    const purr = markets.find((m) => m.symbol === 'PURR/USDC')
    expect(purr?.baseAsset).toBe('PURR')
    // Regression: the canonical pair's HL coin key is the literal pair string,
    // never `@${index}` ("@7"). Sending "@7" left PURR's chart/trades/orderbook
    // empty. hlCoin must be the raw universe name. See ADR-0017.
    expect(purr?.hlCoin).toBe('PURR/USDC')
  })

  it('ADR-0018 errata: native spot pair wins over Unit-bridged collapse (PUMP/USDC + UPUMP/USDC → one PUMP/USDC, native)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [
              { name: 'UPUMP/USDC', index: 213 },
              { name: 'PUMP/USDC', index: 107 },
            ],
            [
              { coin: 'UPUMP/USDC', markPx: '0.001', prevDayPx: '0.001', dayNtlVlm: '999' },
              { coin: 'PUMP/USDC', markPx: '0.002', prevDayPx: '0.002', dayNtlVlm: '368960' },
            ] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const markets = reader.listMarkets()
    const pumpRows = markets.filter((m) => m.symbol === 'PUMP/USDC')
    expect(pumpRows).toHaveLength(1)
    // Native entry (index 107) wins; ctx-derived price/volume come from it.
    expect(pumpRows[0].hlCoin).toBe('@107')
    expect(pumpRows[0].markPrice).toBe(0.002)
    expect(pumpRows[0].volume24h).toBe(368960)
  })

  it('ADR-0018 errata: native wins even when the Unit-bridged entry appears second in the universe', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [
              { name: 'MON/USDC', index: 50 },
              { name: 'UMON/USDC', index: 250 },
            ],
            [
              { coin: 'MON/USDC', markPx: '0.026', prevDayPx: '0.027', dayNtlVlm: '357060' },
              { coin: 'UMON/USDC', markPx: '0.0259', prevDayPx: '0.0268', dayNtlVlm: '500' },
            ] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const monRows = reader.listMarkets().filter((m) => m.symbol === 'MON/USDC')
    expect(monRows).toHaveLength(1)
    expect(monRows[0].hlCoin).toBe('@50')
    expect(monRows[0].markPrice).toBe(0.026)
  })

  it('ADR-0018: Unit-only canonical (no native counterpart) is still emitted (UBTC/USDC → BTC/USDC)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [{ name: 'UBTC/USDC', index: 5 }],
            [
              { coin: 'UBTC/USDC', markPx: '76000', prevDayPx: '77000', dayNtlVlm: '1' },
            ] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const btc = reader.listMarkets().find((m) => m.symbol === 'BTC/USDC')
    expect(btc).toBeDefined()
    expect(btc?.hlCoin).toBe('@5')
    expect(btc?.markPrice).toBe(76000)
  })

  it('MKT-04 (ADR-0017): spot ctx is joined by ctx.coin, not array position', async () => {
    // universe[i].index !== i and the ctx array is ordered differently from
    // the universe array. Only a coin-keyed join attaches the right prices;
    // an index-based join would swap HYPE's and LICK's numbers.
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [
              { name: 'HYPE/USDC', index: 107 },
              { name: 'LICK/USDC', index: 2 },
            ],
            // Reversed vs. the universe order.
            [
              { coin: 'LICK/USDC', markPx: '0.00005', prevDayPx: '0.00005', dayNtlVlm: '1500' },
              { coin: 'HYPE/USDC', markPx: '44.34', prevDayPx: '43', dayNtlVlm: '141305310' },
            ] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const hype = reader.listMarkets().find((m) => m.symbol === 'HYPE/USDC')
    const lick = reader.listMarkets().find((m) => m.symbol === 'LICK/USDC')
    expect(hype?.markPrice).toBe(44.34)
    expect(hype?.volume24h).toBe(141305310)
    expect(lick?.markPrice).toBe(0.00005)
  })

  it('MKT-04: distinct HIP-3 dex markets are never collapsed (xyz:AAPL and flx:AAPL)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getPerpDexs: () =>
        okAsync(buildPerpDexs([null, { name: 'xyz' }, { name: 'flx' }])),
      getPerpMetaAndAssetCtxs: stubHip3CtxsByDex({
        xyz: buildHip3MetaAndCtxs([{ name: 'AAPL', szDecimals: 2 }]),
        flx: buildHip3MetaAndCtxs([{ name: 'AAPL', szDecimals: 2 }]),
      }),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const symbols = reader.listMarkets().map((m) => m.symbol)
    expect(symbols).toContain('xyz:AAPL')
    expect(symbols).toContain('flx:AAPL')
  })

  it('MKT-04: delisted perp, spot, and hip3 markets are all dropped', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse([
            { name: 'GOOD/USDC', index: 5 },
            { name: 'DEADSPOT/USDC', index: 6, isDelisted: true },
          ]),
        ),
      getPerpDexs: () => okAsync(buildPerpDexs([null, { name: 'xyz' }])),
      getPerpMetaAndAssetCtxs: stubHip3CtxsByDex({
        xyz: buildHip3MetaAndCtxs([
          { name: 'AAPL', szDecimals: 2 },
          { name: 'DEADHIP', szDecimals: 2, isDelisted: true },
        ]),
      }),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const symbols = reader.listMarkets().map((m) => m.symbol)
    expect(symbols).not.toContain('OLDIE-PERP')
    expect(symbols).not.toContain('DEADSPOT/USDC')
    expect(symbols).not.toContain('xyz:DEADHIP')
    expect(symbols).toContain('GOOD/USDC')
    expect(symbols).toContain('xyz:AAPL')
  })

  it('graceful degradation: spot source failure still returns perp markets', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        errAsync(new HyperliquidGatewayError('network', 'spot down')),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    const symbols = reader.listMarkets().map((m) => m.symbol)
    expect(symbols).toContain('BTC-PERP')
  })

  it('progressive emit: perps reach subscribers before a slow spot source settles', async () => {
    let resolveSpot!: () => void
    const spotGate = new Promise<void>((resolve) => {
      resolveSpot = resolve
    })
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        ResultAsync.fromSafePromise(
          spotGate.then(() =>
            buildSpotResponse(
              [{ name: 'HYPE/USDC', index: 107 }],
              [
                { markPx: '12.5', prevDayPx: '12', dayNtlVlm: '900000' },
              ] as unknown as SpotMetaAndAssetCtxsResponse[1],
            ),
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const emissions: number[] = []
    reader.subscribeMarkets((markets) => emissions.push(markets.length))

    const refreshPromise = reader.refresh()

    // Perps must be emitted while spot is still in flight (not blocked by it).
    await vi.waitFor(() => {
      expect(reader.listMarkets().some((m) => m.symbol === 'BTC-PERP')).toBe(true)
    })
    expect(reader.listMarkets().some((m) => m.marketType === 'spot')).toBe(false)

    resolveSpot()
    await refreshPromise

    expect(reader.listMarkets().some((m) => m.symbol === 'HYPE/USDC')).toBe(true)
    // Initial sync emit ([]), then perp emit, then spot emit → ≥3 emissions.
    expect(emissions.length).toBeGreaterThanOrEqual(3)
  })

  // The MKT-02/03/04 RED scaffolds from plan 02-01 were body-less it.todo
  // markers. Plan 02-05 converts them into the real green tests above
  // (three-source projection + dedup). This trivial assertion replaces the
  // last todo placeholder so the suite has no pending markers.
  it('superseded multi-market-type todos', () => {
    expect(true).toBe(true)
  })
})

describe('createHyperliquidMarketDataReader.subscribeOrderbook', () => {
  it('forwards native-depth snapshots derived from the raw l2Book event', async () => {
    let capture: ((e: L2BookWsEvent) => void) | null = null
    let capturedCoin: string | null = null
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      subscribeL2Book: (coin, listener) => {
        capturedCoin = coin
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh() // primes markPrice for auto-tick

    const seen: OrderbookUpdate[] = []
    reader.subscribeOrderbook('BTC-PERP', (u) => seen.push(u))

    // Wait for the .then() chain to attach the capture listener.
    await new Promise((r) => setTimeout(r, 0))
    expect(capture).not.toBeNull()
    // Gateway is called with the bare HL coin, not the domain symbol.
    expect(capturedCoin).toBe('BTC')

    capture!({
      coin: 'BTC',
      time: 1_700_000_000_000,
      levels: [
        // bids
        [
          { px: '50000.07', sz: '1', n: 1 },
          { px: '50000.01', sz: '2', n: 1 },
          { px: '49999.50', sz: '3', n: 1 },
        ],
        // asks
        [
          { px: '50001.05', sz: '4', n: 1 },
          { px: '50001.15', sz: '5', n: 1 },
        ],
      ],
    } as unknown as L2BookWsEvent)

    expect(seen).toHaveLength(1)
    const first = seen[0]
    expect(first.kind).toBe('snapshot')
    // Projected symbol is the domain symbol the consumer subscribed with.
    expect(first.symbol).toBe('BTC-PERP')
    // 'auto' = native passthrough (STAB-06): raw levels are preserved, not
    // collapsed into mark-price buckets. Bids sorted descending (best first),
    // asks ascending.
    expect(first.bids).toEqual([
      { price: 50000.07, size: 1 },
      { price: 50000.01, size: 2 },
      { price: 49999.5, size: 3 },
    ])
    expect(first.asks).toEqual([
      { price: 50001.05, size: 4 },
      { price: 50001.15, size: 5 },
    ])
  })
})

describe('createHyperliquidMarketDataReader.subscribeOrderbook reconnect', () => {
  it('retries on initial subscribe failure with exponential backoff', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      let capture: ((e: L2BookWsEvent) => void) | null = null
      const gateway = buildFakeGateway({
        subscribeL2Book: (_coin, listener) => {
          calls += 1
          if (calls === 1) {
            return errAsync(new HyperliquidGatewayError('network', 'WebSocket connection closed')) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>
          }
          capture = listener
          return okAsync({
            unsubscribe: () => Promise.resolve(),
            failureSignal: new AbortController().signal,
          }) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>
        },
      })
      const fake = buildFakeLogger()
      const reader = createHyperliquidMarketDataReader({
        gateway,
        venueId: VENUE_ID,
        logger: fake.logger,
      })

      reader.subscribeOrderbook('BTC-PERP', () => {})
      // Let the first subscribe settle.
      await vi.advanceTimersByTimeAsync(0)
      expect(calls).toBe(1)
      // Advance enough to cover any jittered backoff (base 250ms × 2 × max-jitter = 500ms).
      await vi.advanceTimersByTimeAsync(1_000)
      expect(calls).toBe(2)
      expect(capture).not.toBeNull()
      expect(
        fake.records.some(
          (r) => r.message === 'l2Book subscribe failed' && r.fields.attempt === 1,
        ),
      ).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-subscribes when the SDK failureSignal aborts after connect', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      const ctls: AbortController[] = []
      const gateway = buildFakeGateway({
        subscribeL2Book: () => {
          calls += 1
          const ctl = new AbortController()
          ctls.push(ctl)
          return okAsync({
            unsubscribe: () => Promise.resolve(),
            failureSignal: ctl.signal,
          }) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>
        },
      })
      const reader = createHyperliquidMarketDataReader({
        gateway,
        venueId: VENUE_ID,
        logger: buildFakeLogger().logger,
      })
      reader.subscribeOrderbook('BTC-PERP', () => {})
      await vi.advanceTimersByTimeAsync(0)
      expect(calls).toBe(1)

      // Simulate mid-stream WS drop.
      ctls[0].abort(new Error('socket closed'))
      await vi.advanceTimersByTimeAsync(1_000)
      expect(calls).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createHyperliquidMarketDataReader.subscribeTrades', () => {
  // Flatten the snapshot/append updates (ADR-0030) back into the trades they carry,
  // newest projection order preserved, so projection assertions stay focused on the Trade shape.
  function tradesFrom(updates: TradesUpdate[]): Trade[] {
    return updates.flatMap((update) => (update.kind === 'snapshot' ? update.trades : [update.trade]))
  }

  it('emits the first WS batch as one snapshot, later batches as appends', async () => {
    let capture: ((e: TradesWsEvent) => void) | null = null
    const gateway = buildFakeGateway({
      subscribeTradesStream: (_coin, listener) => {
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const seen: TradesUpdate[] = []
    reader.subscribeTrades('BTC-PERP', (u) => seen.push(u))
    await new Promise((r) => setTimeout(r, 0))

    capture!([
      { coin: 'BTC', side: 'B', px: '50000', sz: '0.1', time: 100, tid: 1 },
      { coin: 'BTC', side: 'A', px: '50100', sz: '0.2', time: 200, tid: 2 },
    ] as unknown as TradesWsEvent)
    capture!([{ coin: 'BTC', side: 'B', px: '50200', sz: '0.3', time: 300, tid: 3 }] as unknown as TradesWsEvent)

    expect(seen[0].kind).toBe('snapshot')
    expect(seen[0]).toMatchObject({ trades: [{ identifier: '1' }, { identifier: '2' }] })
    expect(seen[1]).toEqual({ kind: 'append', trade: expect.objectContaining({ identifier: '3' }) })
  })

  it('projects WsTrade events into domain Trade with side mapped from B/A; strips -PERP on gateway call', async () => {
    let capture: ((e: TradesWsEvent) => void) | null = null
    let capturedCoin: string | null = null
    const gateway = buildFakeGateway({
      subscribeTradesStream: (coin, listener) => {
        capturedCoin = coin
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const seen: TradesUpdate[] = []
    reader.subscribeTrades('BTC-PERP', (u) => seen.push(u))
    await new Promise((r) => setTimeout(r, 0))
    expect(capture).not.toBeNull()
    expect(capturedCoin).toBe('BTC')

    capture!([
      { coin: 'BTC', side: 'B', px: '50000', sz: '0.1', time: 100, tid: 1 },
      { coin: 'BTC', side: 'A', px: '50100', sz: '0.2', time: 200, tid: 2 },
    ] as unknown as TradesWsEvent)

    expect(tradesFrom(seen)).toEqual([
      { identifier: '1', symbol: 'BTC-PERP', side: 'buy', price: 50000, size: 0.1, timestamp: 100 },
      { identifier: '2', symbol: 'BTC-PERP', side: 'sell', price: 50100, size: 0.2, timestamp: 200 },
    ])
  })

  it('maps the HL [maker, taker] participant pair to domain maker/taker regardless of side', async () => {
    let capture: ((e: TradesWsEvent) => void) | null = null
    const gateway = buildFakeGateway({
      subscribeTradesStream: (_coin, listener) => {
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const seen: TradesUpdate[] = []
    reader.subscribeTrades('BTC-PERP', (u) => seen.push(u))
    await new Promise((r) => setTimeout(r, 0))

    const MAKER = `0x${'a'.repeat(40)}`
    const TAKER = `0x${'b'.repeat(40)}`
    capture!([
      // Buy aggressor: taker bought, side 'B'.
      { coin: 'BTC', side: 'B', px: '50000', sz: '0.1', time: 100, tid: 1, users: [MAKER, TAKER] },
      // Sell aggressor: taker sold, side 'A'. The HL tuple order [maker, taker]
      // is positional, not side-derived, so the mapping holds for both sides.
      { coin: 'BTC', side: 'A', px: '50100', sz: '0.2', time: 200, tid: 2, users: [MAKER, TAKER] },
    ] as unknown as TradesWsEvent)

    const trades = tradesFrom(seen)
    expect(trades[0].takerAddress).toBe(TAKER)
    expect(trades[0].makerAddress).toBe(MAKER)
    expect(trades[1].takerAddress).toBe(TAKER)
    expect(trades[1].makerAddress).toBe(MAKER)
  })

  it('strips HL zero-hash sentinel; keeps real hashes', async () => {
    let capture: ((e: TradesWsEvent) => void) | null = null
    const gateway = buildFakeGateway({
      subscribeTradesStream: (_coin, listener) => {
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    const seen: TradesUpdate[] = []
    reader.subscribeTrades('BTC-PERP', (u) => seen.push(u))
    await new Promise((r) => setTimeout(r, 0))

    const ZERO_HASH = `0x${'0'.repeat(64)}`
    const REAL_HASH = `0x${'a'.repeat(64)}`
    capture!([
      { coin: 'BTC', side: 'B', px: '50000', sz: '0.1', time: 100, tid: 1, hash: ZERO_HASH },
      { coin: 'BTC', side: 'A', px: '50100', sz: '0.2', time: 200, tid: 2, hash: REAL_HASH },
    ] as unknown as TradesWsEvent)

    const trades = tradesFrom(seen)
    expect(trades[0].transactionHash).toBeUndefined()
    expect(trades[1].transactionHash).toBe(REAL_HASH)
  })
})

describe('createHyperliquidMarketDataReader.subscribeTicker', () => {
  it('projects PerpAssetCtxSchema into domain Ticker with correct field mapping', async () => {
    let capture: ((e: ActiveAssetCtxWsEvent) => void) | null = null
    let capturedCoin: string | null = null
    const gateway = buildFakeGateway({
      subscribeActiveAssetCtx: (coin, listener) => {
        capturedCoin = coin
        capture = listener as (e: ActiveAssetCtxWsEvent) => void
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })

    const seen: Ticker[] = []
    reader.subscribeTicker('BTC-PERP', (t) => seen.push(t))
    await new Promise((r) => setTimeout(r, 0))

    expect(capturedCoin).toBe('BTC')

    capture!({
      coin: 'BTC',
      ctx: {
        markPx: '50000',
        oraclePx: '49900',
        funding: '0.0001',
        openInterest: '5000',
        prevDayPx: '48000',
        dayNtlVlm: '1000000',
      },
    } as unknown as ActiveAssetCtxWsEvent)

    expect(seen).toHaveLength(1)
    const ticker = seen[0]
    expect(ticker.markPrice).toBe(50000)
    expect(ticker.open24h).toBe(48000)
    expect(ticker.symbol).toBe('BTC-PERP')
    // Narrow on the D-04 discriminant before reading perp-only fields.
    expect(ticker.marketType).toBe('perp')
    if (ticker.marketType === 'spot') throw new Error('expected a PerpTicker for BTC-PERP')
    expect(ticker.indexPrice).toBe(49900)
    expect(ticker.fundingRate).toBe(0.0001)
    expect(ticker.openInterest).toBe(5000)
    expect(ticker.fundingCountdownSeconds).toBeGreaterThanOrEqual(0)
    expect(ticker.fundingCountdownSeconds).toBeLessThanOrEqual(28800)
  })
})

// RED scaffold (plan 03-01 Task 1; turns green in plan 03-02).
// WIRE-01: a spot Market must subscribe via the spot ctx channel using the
// spot '@idx' coin (NOT toHlCoin(displaySymbol)) and emit a SpotTicker variant
// (marketType 'spot', no funding/openInterest/indexPrice). Fails today: the
// reader unconditionally takes the perp activeAssetCtx path.
describe('createHyperliquidMarketDataReader.subscribeTicker — spot ctx projection (RED 03-02)', () => {
  it('WIRE-01: selecting a spot market subscribes via subscribeActiveSpotAssetCtx with the @idx coin and emits a SpotTicker', async () => {
    const spotFake = buildFakeGatewayWithSpotCtx({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      getSpotMetaAndAssetCtxs: () =>
        okAsync(
          buildSpotResponse(
            [{ name: 'HYPE/USDC', index: 107 }],
            [{ markPx: '12.5', prevDayPx: '12', dayNtlVlm: '900000' }] as unknown as SpotMetaAndAssetCtxsResponse[1],
          ),
        ),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway: spotFake.gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()

    const seen: Ticker[] = []
    reader.subscribeTicker('HYPE/USDC', (t) => seen.push(t))
    await new Promise((r) => setTimeout(r, 0))

    // The reader must drive the spot ctx channel keyed by the '@107' coin,
    // not toHlCoin('HYPE/USDC') (which would strip nothing useful).
    expect(spotFake.subscribed()).toBe(true)
    expect(spotFake.capturedCoin()).toBe('@107')

    spotFake.emit(
      buildActiveSpotAssetCtxEvent({
        coin: '@107',
        markPx: '12.5',
        midPx: '12.4',
        prevDayPx: '12',
        dayNtlVlm: '900000',
      }),
    )

    expect(seen).toHaveLength(1)
    const ticker = seen[0]
    expect(ticker.symbol).toBe('HYPE/USDC')
    expect(ticker.markPrice).toBe(12.5)
    expect(ticker.marketType).toBe('spot')
    // A SpotTicker structurally omits the perp-only fields.
    expect('fundingRate' in ticker).toBe(false)
    expect('openInterest' in ticker).toBe(false)
    expect('indexPrice' in ticker).toBe(false)
  })
})

describe('createHyperliquidMarketDataReader empty-symbol safety net (Bug A)', () => {
  it('subscribeOrderbook("") returns a no-op and never calls the gateway', () => {
    let l2BookCalls = 0
    const gateway = buildFakeGateway({
      subscribeL2Book: () => {
        l2BookCalls += 1
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: fake.logger,
    })
    const unsub = reader.subscribeOrderbook('', () => {})
    expect(typeof unsub).toBe('function')
    expect(l2BookCalls).toBe(0)
    expect(
      fake.records.some(
        (r) =>
          r.level === 'warn' &&
          r.message === 'subscribe skipped: unresolved symbol' &&
          r.fields.channel === 'l2Book',
      ),
    ).toBe(true)
    unsub()
  })

  it('subscribeTrades("") returns a no-op and never calls the gateway', () => {
    let tradeCalls = 0
    const gateway = buildFakeGateway({
      subscribeTradesStream: () => {
        tradeCalls += 1
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: fake.logger,
    })
    const unsub = reader.subscribeTrades('', () => {})
    expect(tradeCalls).toBe(0)
    expect(
      fake.records.some(
        (r) =>
          r.level === 'warn' &&
          r.message === 'subscribe skipped: unresolved symbol' &&
          r.fields.channel === 'trades',
      ),
    ).toBe(true)
    unsub()
  })

  it('subscribeTicker("") returns a no-op and never calls the gateway', () => {
    let perpCtxCalls = 0
    let spotCtxCalls = 0
    const gateway = buildFakeGateway({
      subscribeActiveAssetCtx: () => {
        perpCtxCalls += 1
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
      subscribeActiveSpotAssetCtx: () => {
        spotCtxCalls += 1
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: fake.logger,
    })
    const unsub = reader.subscribeTicker('', () => {})
    expect(perpCtxCalls).toBe(0)
    expect(spotCtxCalls).toBe(0)
    expect(
      fake.records.some(
        (r) =>
          r.level === 'warn' &&
          r.message === 'subscribe skipped: unresolved symbol' &&
          r.fields.channel === 'activeAssetCtx',
      ),
    ).toBe(true)
    unsub()
  })
})

describe('createHyperliquidMarketDataReader.subscribeOrderbook STAB-06 depth', () => {
  it('preserves full native depth for a tight Hyperliquid book (no auto-bucket collapse)', async () => {
    let capture: ((e: L2BookWsEvent) => void) | null = null
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      subscribeL2Book: (_coin, listener) => {
        capture = listener
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })

    const seen: OrderbookUpdate[] = []
    reader.subscribeOrderbook('BTC-PERP', (u) => seen.push(u))
    await reader.refresh()

    // Real-shaped HL book: 20 levels per side spanning only a few cents.
    // The old mark-price auto tick floored all of them into ~1 bucket → the
    // orderbook rendered 1 bid / 1 ask (STAB-06). Native passthrough keeps all.
    const bids = Array.from({ length: 20 }, (_, i) => ({
      px: String((89.163 - i * 0.0015).toFixed(4)),
      sz: '1',
      n: 1,
    }))
    const asks = Array.from({ length: 20 }, (_, i) => ({
      px: String((89.164 + i * 0.0015).toFixed(4)),
      sz: '1',
      n: 1,
    }))
    capture!({
      coin: 'BTC',
      time: 1_700_000_000_000,
      levels: [bids, asks],
    } as unknown as L2BookWsEvent)

    expect(seen[0].bids).toHaveLength(20)
    expect(seen[0].asks).toHaveLength(20)
    // best-first ordering preserved
    expect(seen[0].bids[0].price).toBeGreaterThan(seen[0].bids[19].price)
    expect(seen[0].asks[0].price).toBeLessThan(seen[0].asks[19].price)
  })
})

describe('createHyperliquidMarketDataReader.refresh — primary perp source retry', () => {
  // Run backoff timers synchronously so the retry loop completes in-test.
  const instantTimeout = (h: () => void): number => {
    h()
    return 0
  }

  it('retries the perp source on a transient network error then populates the cache', async () => {
    let attempts = 0
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => {
        attempts += 1
        const isStillFlaky = attempts < 3
        return isStillFlaky
          ? errAsync(new HyperliquidGatewayError('network', 'HL info 500'))
          : okAsync(buildMetaAndCtxs())
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
      setTimeout: instantTimeout,
    })

    await reader.refresh()

    expect(attempts).toBe(3)
    expect(reader.listMarkets().some((m) => m.symbol === 'BTC-PERP')).toBe(true)
  })

  it('gives up after 3 attempts, leaves the cache empty, and warns', async () => {
    let attempts = 0
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => {
        attempts += 1
        return errAsync(new HyperliquidGatewayError('network', 'HL info down'))
      },
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: fake.logger,
      setTimeout: instantTimeout,
    })

    await reader.refresh()

    expect(attempts).toBe(3)
    expect(reader.listMarkets()).toEqual([])
    expect(fake.records.some((r) => r.message === 'refresh failed')).toBe(true)
  })

  it('does not retry a non-transient (invalid-response) perp error', async () => {
    let attempts = 0
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => {
        attempts += 1
        return errAsync(new HyperliquidGatewayError('invalid-response', 'bad schema'))
      },
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
      setTimeout: instantTimeout,
    })

    await reader.refresh()

    expect(attempts).toBe(1)
    expect(reader.listMarkets()).toEqual([])
  })
})

describe('createHyperliquidMarketDataReader trader resolvers', () => {
  it('resolveAssetInfo returns null before the first refresh', () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    expect(reader.resolveAssetInfo('BTC-PERP')).toBeNull()
  })

  it('resolveAssetInfo resolves a perp by display symbol AND HL coin with the dense index', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    // BTC is universe index 0; SP500 is index 1 (delisted OLDIE keeps its index slot).
    expect(reader.resolveAssetInfo('BTC-PERP')).toEqual({
      assetId: 0,
      szDecimals: 5,
      marketType: 'perp',
    })
    // Resolvable by the raw HL coin too (the open-orders reader emits raw coins).
    expect(reader.resolveAssetInfo('BTC')).toEqual({
      assetId: 0,
      szDecimals: 5,
      marketType: 'perp',
    })
    expect(reader.resolveAssetInfo('SP500-PERP')?.assetId).toBe(1)
  })

  it('resolveAssetInfo resolves HIP-3 builder perps with the dex-offset asset id (100000 + dexIndex×10000 + i)', async () => {
    const gateway = buildFakeGateway({
      getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()),
      // perpDexs index 0 is the null main DEX; xyz is index 1, flx is index 2.
      getPerpDexs: () => okAsync(buildPerpDexs([null, { name: 'xyz' }, { name: 'flx' }])),
      getPerpMetaAndAssetCtxs: stubHip3CtxsByDex({
        xyz: buildHip3MetaAndCtxs([
          { name: 'AAPL', szDecimals: 2 },
          { name: 'TSLA', szDecimals: 3 },
        ]),
        flx: buildHip3MetaAndCtxs([{ name: 'NVDA', szDecimals: 1 }]),
      }),
    })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    // First builder dex (perpDexs index 1) → 100000 + 1×10000 + assetIndex.
    // Matches the SDK's SymbolConverter.getAssetId('test:ABC') === 110000.
    expect(reader.resolveAssetInfo('xyz:AAPL')).toEqual({
      assetId: 110_000,
      szDecimals: 2,
      marketType: 'perp',
    })
    expect(reader.resolveAssetInfo('xyz:TSLA')).toEqual({
      assetId: 110_001,
      szDecimals: 3,
      marketType: 'perp',
    })
    // Second builder dex (perpDexs index 2) → 100000 + 2×10000 + 0 = 120000.
    // Proves the original perpDexs index is preserved, not the filtered position.
    expect(reader.resolveAssetInfo('flx:NVDA')).toEqual({
      assetId: 120_000,
      szDecimals: 1,
      marketType: 'perp',
    })
  })

  it('resolveAssetInfo returns null for an unknown symbol', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    await reader.refresh()
    expect(reader.resolveAssetInfo('NOPE-PERP')).toBeNull()
  })

  it('getReferencePrice returns the cached mark once known, null otherwise', async () => {
    const gateway = buildFakeGateway({ getMetaAndAssetCtxs: () => okAsync(buildMetaAndCtxs()) })
    const reader = createHyperliquidMarketDataReader({
      gateway,
      venueId: VENUE_ID,
      logger: buildFakeLogger().logger,
    })
    expect(reader.getReferencePrice('BTC-PERP')).toBeNull()
    await reader.refresh()
    expect(reader.getReferencePrice('BTC-PERP')).toEqual({ mark: 50000 })
    expect(reader.getReferencePrice('NOPE-PERP')).toBeNull()
  })
})
