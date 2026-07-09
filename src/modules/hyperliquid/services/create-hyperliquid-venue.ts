import type { Venue } from '@/modules/shared/domain'
import type { HyperliquidVenueOptions } from '../hyperliquid.types'
import {
  HYPERLIQUID_EXPLORER_BASE_URL,
  HYPERLIQUID_VENUE_ID,
  HYPERLIQUID_VENUE_LABEL,
} from '../hyperliquid.constants'
import {
  createNktkasHyperliquidGateway,
  createNktkasHyperliquidExchangeGateway,
  type HyperliquidExchangeGateway,
  type HyperliquidGateway,
} from '../gateway'
import { withGatewayCache } from '../gateway/cached-hyperliquid-gateway'
import { HYPERLIQUID_BUILDER } from '../hyperliquid.constants'
import { createHyperliquidTrader } from './hyperliquid-trader'
import { createHyperliquidOrderValidation } from './hyperliquid-order-validation'
import { createHyperliquidOrderRefResolver } from './hyperliquid-order-ref-resolver'
import {
  createHyperliquidLeverageMargin,
  type HyperliquidLeverageState,
} from './hyperliquid-leverage-margin'
import {
  createHyperliquidPositionProtection,
  type HyperliquidPositionState,
} from './hyperliquid-position-protection'
import type { HyperliquidOrderRef, HyperliquidValidationPosition } from './hyperliquid-trader.types'
import type { Balance, Order, PerpPositionSnapshot } from '@/modules/shared/domain'
import { USDC_SYMBOL } from '../hyperliquid.constants'
import { createWebData2Stream } from './web-data2-stream'
import { createAllDexsClearinghouseStateStream } from './all-dexs-clearinghouse-state-stream'
import { createHyperliquidPullService } from './hyperliquid-pull'
import { createHyperliquidPortfolioReader } from './portfolio-reader'
import { createHyperliquidBalancesReader } from './balances-reader'
import { createHyperliquidAccountModeReader } from './account-mode-reader'
import { createHyperliquidEquityExtensionsReader } from './equity-extensions-reader'
import { createHyperliquidMarginSummaryReader } from './margin-summary-reader'
import { createHyperliquidFeeScheduleReader } from './fee-schedule-reader'
import { createHyperliquidVolumeHistoryReader } from './volume-history-reader'
import { createHyperliquidPerpsPositionsSnapshotReader } from './perps-positions-snapshot-reader'
import { createHyperliquidOpenOrdersSnapshotReader } from './open-orders-snapshot-reader'
import { createHyperliquidTwapActiveSnapshotReader } from './twap-active-snapshot-reader'
import { createHyperliquidTwapHistoryReader } from './twap-history-reader'
import { createHyperliquidTwapSliceFillsReader } from './twap-slice-fills-reader'
import { createHyperliquidTwapController } from './hyperliquid-twap-controller'
import { createHyperliquidTradeHistoryReader } from './trade-history-reader'
import { createHyperliquidFundingHistoryReader } from './funding-history-reader'
import { createHyperliquidOrderHistoryReader } from './order-history-reader'
import { createHyperliquidInterestHistoryReader } from './interest-history-reader'
import { createHyperliquidAccountActivityReader } from './account-activity-reader'
import { createHyperliquidMarketDataReader } from './market-data-reader'
import { createHyperliquidCandlesReader } from './candles-reader'
import { createActingAccountSources } from './acting-account-sources'

export interface CreateHyperliquidVenueDeps {
  /** Override gateway for tests. Defaults to createNktkasHyperliquidGateway(). */
  readonly gateway?: HyperliquidGateway
  /**
   * Override the exchange (signing) gateway for tests. Defaults to
   * `createNktkasHyperliquidExchangeGateway()`. The trading write path; kept
   * separate from the info gateway so tests inject a fake without touching the
   * read path.
   */
  readonly exchangeGateway?: HyperliquidExchangeGateway
}

export function createHyperliquidVenue(
  options: HyperliquidVenueOptions,
  deps: CreateHyperliquidVenueDeps = {},
): Venue {
  const log = options.logger.child({ module: 'hyperliquid-venue' })
  log.info({ network: options.network }, 'create')
  const baseGateway = deps.gateway ?? createNktkasHyperliquidGateway({
    isTestnet: options.network === 'testnet',
    apiHttpUrl: options.apiHttpUrl,
    apiWsUrl: options.apiWsUrl,
    logger: options.logger,
    // One chokepoint for every channel's WS events → drives the liveness probe.
    notifyActivity: options.notifyActivity,
  })
  // Compose the persistent cache once, so every downstream consumer (stream,
  // pull, readers, marketData) shares one cache entry per key — e.g. refresh()
  // and the pull both reading spotMeta on a cold reload hit the same entry.
  // See docs/adr/0022-gateway-persistent-cache.md.
  const gateway = withGatewayCache(baseGateway, {
    network: options.network,
    logger: options.logger,
  })
  const stream = createWebData2Stream({
    gateway,
    getAddress: options.getAddress,
    logger: options.logger,
    resyncSignal: options.resyncSignal,
  })
  // Positions source off webData2 (default-dex only) and onto
  // allDexsClearinghouseState, which returns the main perp dex PLUS every
  // HIP-3 dex in one event — so builder-deployed perps (e.g. xyz:NVDA) appear.
  // webData2 still feeds balances/portfolio/open-orders/twap.
  const allDexsClearinghouseStateStream = createAllDexsClearinghouseStateStream({
    gateway,
    getAddress: options.getAddress,
    logger: options.logger,
    resyncSignal: options.resyncSignal,
  })
  const pull = createHyperliquidPullService({
    gateway,
    getAddress: options.getAddress,
    logger: options.logger,
  })
  const venueId = `${HYPERLIQUID_VENUE_ID}:${options.network}`
  const marketData = createHyperliquidMarketDataReader({
    gateway,
    venueId,
    logger: options.logger,
    resyncSignal: options.resyncSignal,
  })
  // No side effects at construction: the composition root owns the venue
  // lifecycle (initial marketData.refresh() + dispose() teardown) via an
  // effect, so StrictMode / re-render does not spawn duplicate streams.
  // See docs/adr/0015-venue-dispose-lifecycle.md.
  const candles = createHyperliquidCandlesReader({
    gateway,
    logger: options.logger,
    resyncSignal: options.resyncSignal,
  })

  // Trading write path (Task 8 wiring). The exchange gateway owns SDK signing +
  // POST; the trader adapter translates the venue-agnostic request and unpacks
  // the response. Its deps reuse the existing market-data plumbing (asset info +
  // mark reference) and the open-orders snapshot (order-ref resolution) — no
  // second symbol converter, no second stream. The signing wallet is resolved
  // lazily via the bridged getter; an absent signer yields a typed error, never
  // a throw. The `trader` capability is always declared (HL *can* trade);
  // runtime readiness is handled by the submit gates, not by hiding it.
  const exchangeGateway =
    deps.exchangeGateway ??
    createNktkasHyperliquidExchangeGateway({
      isTestnet: options.network === 'testnet',
      logger: options.logger,
    })
  const openOrdersSnapshot = createHyperliquidOpenOrdersSnapshotReader(stream, options.logger)
  // VIEWING perps snapshot — keyed to `spectate ?? connected`. Feeds the account
  // dock's Positions tab and the leverage/margin display SEED for the viewing
  // account. The order flow reads the ACTING snapshot below instead (ADR-0038).
  const perpsPositionsSnapshot = createHyperliquidPerpsPositionsSnapshotReader(
    allDexsClearinghouseStateStream,
    options.logger,
  )

  // Acting-Address-keyed account sources for the order flow (ADR-0038 D-1/D-2).
  // Lazily diverge from the viewing sources only while spectating; when acting
  // === viewing they alias the viewing instances (zero extra subscriptions). The
  // `getActingAddress` default is `getAddress`, so tests / mock-venue with no
  // spectate concept see acting === viewing and the order data is unchanged.
  const getActingAddress = options.getActingAddress ?? options.getAddress
  const acting = createActingAccountSources({
    gateway,
    viewingStream: stream,
    viewingAllDexsStream: allDexsClearinghouseStateStream,
    viewingPull: pull,
    getAddress: options.getAddress,
    getActingAddress,
    logger: options.logger,
  })
  const actingPortfolio = createHyperliquidPortfolioReader(
    acting.stream,
    acting.allDexsClearinghouseStateStream,
    acting.pull,
    gateway,
    getActingAddress,
    options.logger,
  )
  const actingBalances = createHyperliquidBalancesReader(acting.stream, acting.pull, options.logger)
  const actingFeeSchedule = createHyperliquidFeeScheduleReader(acting.pull, options.logger)
  // Acting-keyed account mode for the Manage Funds flows (Transfer's Perps⇄Spot
  // applicability check) — same acting.pull source actingBalances/actingFeeSchedule
  // use, so spectating a unified-mode account never misreports the User's own
  // (possibly classic-mode) transfer applicability.
  const actingAccountMode = createHyperliquidAccountModeReader(acting.pull, options.logger)
  const actingPerpsPositionsSnapshot = createHyperliquidPerpsPositionsSnapshotReader(
    acting.allDexsClearinghouseStateStream,
    options.logger,
  )
  const orderRefResolver = createHyperliquidOrderRefResolver({
    openOrders: openOrdersSnapshot,
    resolveAssetInfo: (symbol) => marketData.resolveAssetInfo(symbol),
  })
  const getAgentWallet = options.getAgentWallet ?? (() => null)
  const baseTrader = createHyperliquidTrader({
    exchangeGateway,
    getAgentWallet,
    resolveAsset: (symbol) => marketData.resolveAssetInfo(symbol),
    resolveOrderRef: (identifier) => orderRefResolver.resolve(identifier),
    getReferencePrice: (symbol) => marketData.getReferencePrice(symbol),
    logger: options.logger,
    builder: {
      address: HYPERLIQUID_BUILDER[options.network].address,
      feeTenthsOfBps: HYPERLIQUID_BUILDER[options.network].feeTenthsOfBps,
    },
  })

  // Venue-owned order validation + preview (ADR-0035). The account-state readers
  // are subscribed once and their latest projections cached into mutable
  // holders so the synchronous `validateDraft` / `previewOrder` can read them at
  // call time. `previewOrder` reads the live mark from the reader's ticker cache
  // (bug #2) — no extra subscription. Composed onto the base trader so the port
  // methods are present.
  const portfolio = createHyperliquidPortfolioReader(
    stream,
    allDexsClearinghouseStateStream,
    pull,
    gateway,
    options.getAddress,
    options.logger,
  )
  const balances = createHyperliquidBalancesReader(stream, pull, options.logger)
  const feeSchedule = createHyperliquidFeeScheduleReader(pull, options.logger)
  // The positions snapshot feeds both leverage/margin (below) and the
  // reduce-only-reduces validation rule (S6, ADR-0035 D-8). Subscribe once and
  // cache the latest array into a holder so the synchronous validator can read
  // the open position for a symbol at call time — same holder pattern S2 used
  // for portfolio / balances / feeSchedule.
  // The order-validation / preview / leverage holders read the ACTING-keyed
  // readers so `validateDraft`, `previewOrder`, `maxCoinSize`, reduce-only
  // validation, the fee estimate, and the leverage seed all reflect the
  // authenticated User's own account regardless of spectate state (ADR-0038
  // D-1). The viewing `portfolio` / `balances` / `feeSchedule` / positions
  // capabilities keep feeding the dock / portfolio unchanged.
  let latestPositions: ReadonlyArray<PerpPositionSnapshot> = []
  const stopPositionsCache = actingPerpsPositionsSnapshot.subscribe((positions) => {
    latestPositions = positions
  })
  let availablePerpsMargin = 0
  let latestBalances: ReadonlyArray<Balance> = []
  let perpsTakerRate = 0
  const stopAvailableCache = actingPortfolio.subscribeSnapshot('perps', (snapshot) => {
    availablePerpsMargin = snapshot.accountValue
  })
  const stopBalancesCache = actingBalances.subscribe('all', (rows) => {
    latestBalances = rows
  })
  const stopFeeCache = actingFeeSchedule.subscribe((schedule) => {
    perpsTakerRate = schedule.userPerpsTakerRate
  })
  // Resolve the open position for a display symbol → the validator's
  // `{ side, size }` view. Matches by asset id (the snapshot keys by raw HL
  // coin; the UI passes display symbols), mirroring `getCurrentLeverageState`.
  const currentPositionFor = (symbol: string): HyperliquidValidationPosition | null => {
    const target = marketData.resolveAssetInfo(symbol)
    if (target === null) return null
    const match = latestPositions.find(
      (position) => marketData.resolveAssetInfo(position.symbol)?.assetId === target.assetId,
    )
    if (match === undefined) return null
    return { side: match.side === 'long' ? 'buy' : 'sell', size: match.size }
  }
  const isSpotMarket = (symbol: string): boolean =>
    marketData.listMarkets().find((m) => m.symbol === symbol)?.marketType === 'spot'
  const spotAvailableFor = (symbol: string, side: 'buy' | 'sell'): number => {
    const market = marketData.listMarkets().find((m) => m.symbol === symbol)
    if (market === undefined) return 0
    const wantsUsdc = side === 'buy'
    const wantedAsset = wantsUsdc ? USDC_SYMBOL : market.baseAsset
    for (const balance of latestBalances) {
      const isSpotPool = balance.source === 'spot' || balance.source === 'unified'
      const matchesAsset = balance.asset === wantedAsset
      if (isSpotPool && matchesAsset) return balance.available
    }
    return 0
  }
  const markPriceFor = (symbol: string): number => {
    const liveMark = marketData.getLiveMark(symbol)
    if (liveMark !== null && liveMark > 0) return liveMark
    return marketData.getReferencePrice(symbol)?.mark ?? 0
  }
  const orderValidation = createHyperliquidOrderValidation({
    markPriceFor,
    resolveAsset: (symbol) => marketData.resolveAssetInfo(symbol),
    currentPositionFor,
    availableMarginFor: () => availablePerpsMargin,
    spotAvailableFor,
    isSpotMarket,
    takerRate: () => perpsTakerRate,
    hasBuilderFee: true,
  })
  const trader = {
    ...baseTrader,
    validateDraft: orderValidation.validateDraft,
    previewOrder: orderValidation.previewOrder,
  }

  // Leverage + margin mode (Task 9). Both ride HL's single `updateLeverage`
  // action; the controller re-sends the unchanged dimension from the live
  // positions snapshot (the `latestPositions` holder subscribed above, now
  // shared with the S6 reduce-only rule). `getCurrentState` resolves by asset id
  // (the snapshot keys by raw HL coin; the UI passes display symbols).
  const getCurrentLeverageState = (symbol: string): HyperliquidLeverageState | null => {
    const target = marketData.resolveAssetInfo(symbol)
    if (target === null) return null
    const match = latestPositions.find(
      (position) => marketData.resolveAssetInfo(position.symbol)?.assetId === target.assetId,
    )
    if (match === undefined) return null
    return { leverage: match.leverage, isCross: match.leverageType === 'cross' }
  }
  const { leverageController, marginModeController } = createHyperliquidLeverageMargin({
    exchangeGateway,
    getAgentWallet,
    resolveAsset: (symbol) => marketData.resolveAssetInfo(symbol),
    getCurrentState: getCurrentLeverageState,
    logger: options.logger,
  })

  // Position-level TP/SL (Task 13). Resolves the live position direction/size
  // for the symbol (the trigger orders close it, opposite side) and the resting
  // reduce-only trigger orders to clear on replace/remove. Caches the latest
  // open-orders snapshot alongside the positions cache so both resolvers are
  // synchronous.
  let latestOpenOrders: ReadonlyArray<Order> = []
  const stopOpenOrdersCache = openOrdersSnapshot.subscribe((orders) => {
    latestOpenOrders = orders
  })
  const getPositionState = (symbol: string): HyperliquidPositionState | null => {
    const target = marketData.resolveAssetInfo(symbol)
    if (target === null) return null
    const match = latestPositions.find(
      (position) => marketData.resolveAssetInfo(position.symbol)?.assetId === target.assetId,
    )
    if (match === undefined) return null
    return {
      side: match.side === 'long' ? 'buy' : 'sell',
      size: match.size,
      referencePrice: match.markPrice,
    }
  }
  const getProtectionOrderRefs = (symbol: string): ReadonlyArray<HyperliquidOrderRef> => {
    const target = marketData.resolveAssetInfo(symbol)
    if (target === null) return []
    return latestOpenOrders.flatMap((order) => {
      const asset = marketData.resolveAssetInfo(order.symbol)
      const matchesSymbol = asset?.assetId === target.assetId
      const isTrigger = order.triggerConditions !== undefined
      const isReduceOnly = order.reduceOnly === true
      const oid = Number(order.identifier)
      const hasOid = Number.isInteger(oid)
      const isProtectionOrder = matchesSymbol && isTrigger && isReduceOnly && hasOid
      if (!isProtectionOrder || asset === null) return []
      const ref: HyperliquidOrderRef = {
        assetId: asset.assetId,
        oid,
        symbol: order.symbol,
        side: order.side,
        price: order.price,
        size: order.originalSize ?? order.size,
        reduceOnly: true,
      }
      return [ref]
    })
  }
  const positionProtection = createHyperliquidPositionProtection({
    exchangeGateway,
    getAgentWallet,
    resolveAsset: (symbol) => marketData.resolveAssetInfo(symbol),
    getPositionState,
    getProtectionOrderRefs,
    logger: options.logger,
    builder: {
      address: HYPERLIQUID_BUILDER[options.network].address,
      feeTenthsOfBps: HYPERLIQUID_BUILDER[options.network].feeTenthsOfBps,
    },
  })

  // TWAP cancel controller (ADR-0052). Agent-signed `twapCancel`; no builder
  // params (a cancel carries no fee). Resolves `a` via the asset resolver and
  // `t` from the TWAP's snapshot `identifier`.
  const twapController = createHyperliquidTwapController({
    exchangeGateway,
    getAgentWallet,
    resolveAsset: (symbol) => marketData.resolveAssetInfo(symbol),
    logger: options.logger,
  })

  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    log.info({ network: options.network }, 'dispose')
    stream.stop()
    allDexsClearinghouseStateStream.stop()
    pull.stop()
    // Tear down the order-flow holders BEFORE stopping the acting sources, so the
    // selectors see zero live subscriptions and skip a redundant teardown pass.
    stopPositionsCache()
    stopOpenOrdersCache()
    stopAvailableCache()
    stopBalancesCache()
    stopFeeCache()
    acting.stop()
    orderRefResolver.stop()
  }
  // Spectate enter/leave re-keys the VIEWING sources only (ADR-0038 D-3). It must
  // ALSO re-route the acting selectors: when spectate flips, the Viewing Address
  // diverges from / converges to the Acting Address, so a holder currently
  // aliasing the viewing source must move to (or off) the connected-keyed acting
  // instance. The selector's refreshAddress does exactly that without re-keying
  // the acting address (which spectate never changes).
  const refreshAddress = (): void => {
    // Revival: refreshAddress is the consumer's "wake up" signal. If a prior
    // dispose() (most commonly React 19 StrictMode's dispose-on-cleanup pass
    // against this venue's useMemo cache) left us with disposed=true, clear
    // it here. stream/pull each carry the same revive-on-refresh pattern, so
    // a single refreshAddress call brings the whole venue back to life.
    if (disposed) {
      log.info({ network: options.network }, 'refresh after dispose — reviving')
      disposed = false
    }
    stream.refreshAddress()
    allDexsClearinghouseStateStream.refreshAddress()
    pull.refreshAddress()
    acting.refreshActingAddress()
  }
  // Wallet rotation re-keys BOTH closures (ADR-0038 D-3): the viewing sources via
  // refreshAddress() above, the acting account streams here. The composition root
  // calls both from its address-mirror effect.
  const refreshActingAddress = (): void => {
    if (disposed) disposed = false
    acting.refreshActingAddress()
  }
  return {
    metadata: {
      id: venueId,
      label: HYPERLIQUID_VENUE_LABEL,
      explorerTxUrl: (hash) => `${HYPERLIQUID_EXPLORER_BASE_URL[options.network]}/tx/${hash}`,
    },
    dispose,
    refreshAddress,
    refreshActingAddress,
    capabilities: {
      connection: stream.connectionStatus,
      marketData,
      candles,
      portfolio,
      balances,
      accountMode: createHyperliquidAccountModeReader(pull, options.logger),
      equityExtensions: createHyperliquidEquityExtensionsReader(stream, pull, options.logger),
      marginSummary: createHyperliquidMarginSummaryReader(
        stream,
        allDexsClearinghouseStateStream,
        pull,
        options.logger,
      ),
      feeSchedule,
      volumeHistory: createHyperliquidVolumeHistoryReader(pull, options.logger),
      perpsPositionsSnapshot,
      openOrdersSnapshot,
      trader,
      leverageController,
      marginModeController,
      positionProtection,
      twapController,
      twapActiveSnapshot: createHyperliquidTwapActiveSnapshotReader(stream, options.logger),
      twapHistory: createHyperliquidTwapHistoryReader(gateway, options.getAddress, options.logger),
      twapSliceFills: createHyperliquidTwapSliceFillsReader(
        gateway,
        options.getAddress,
        options.logger,
      ),
      tradeHistory: createHyperliquidTradeHistoryReader(gateway, options.getAddress, options.logger),
      fundingHistory: createHyperliquidFundingHistoryReader(gateway, options.getAddress, options.logger),
      orderHistory: createHyperliquidOrderHistoryReader(gateway, options.getAddress, options.logger),
      interestHistory: createHyperliquidInterestHistoryReader(gateway, options.getAddress, options.logger),
      accountActivity: createHyperliquidAccountActivityReader(gateway, options.getAddress, options.logger),
      // Acting-Address-keyed account readers for the order flow (ADR-0038 D-1).
      // Same reader projections as the viewing capabilities above, but sourced
      // from the lazily-diverging acting streams so order entry / validation /
      // preview / leverage seed read the connected wallet while Spectating.
      ownAccount: {
        portfolio: actingPortfolio,
        balances: actingBalances,
        perpsPositionsSnapshot: actingPerpsPositionsSnapshot,
        feeSchedule: actingFeeSchedule,
        accountMode: actingAccountMode,
      },
    },
  }
}
