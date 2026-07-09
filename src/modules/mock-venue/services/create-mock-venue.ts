import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type {
  Venue,
  Market,
  OrderbookUpdate,
  Trade,
  TradesUpdate,
  Ticker,
  Order,
  Fill,
  Position,
  PlaceOrderOutcome,
  PlaceOrderRequest,
  StopMarketOrderRequest,
  StopLimitOrderRequest,
  ModifyOrderRequest,
  OrderIdentifier,
  ConnectionStatus,
  Unsubscribe,
  Candle,
  CandleUpdate,
  Interval,
  CandleError,
  PortfolioSnapshot,
  PortfolioMetric,
  PortfolioWindow,
  PortfolioPoint,
  PortfolioAccountScope,
  ConnectionStatusSource,
  PortfolioReader,
  EquityExtensionsReader,
  EquityExtensionBucket,
  MarginSummaryReader,
  MarginSummarySnapshot,
  FeeScheduleReader,
  FeeSchedule,
  BalancesReader,
  Balance,
  AccountMode,
  AccountModeReader,
  PositionsReader,
  PerpPositionSnapshot,
  PerpsPositionsSnapshotReader,
  OpenOrdersReader,
  OpenOrdersSnapshotReader,
  ActiveTwap,
  TwapActiveSnapshotReader,
  TwapHistoryEntry,
  TwapHistoryReader,
  TwapSliceFillsReader,
  TwapController,
  TradeHistoryReader,
  FundingHistoryEntry,
  FundingHistoryReader,
  HistoricalOrder,
  OrderHistoryReader,
  InterestHistoryEntry,
  InterestHistoryReader,
  AccountActivityEntry,
  AccountActivityReader,
  FillsReader,
  Trader,
  CandlesReader,
  MarketDataReader,
} from '../../shared/domain'
import {
  PlaceOrderError,
  CancelOrderError,
  ModifyOrderError,
  PortfolioHistoryError,
} from '../../shared/domain'
import {
  getHistory,
  loadOlder as loadOlderCandles,
  subscribe as subscribeCandleStream,
} from '../candle-generator'
import type { Result } from 'neverthrow'
import { generateSnapshot, generateDiff } from '../orderbook-generator'
import { generateTrade } from '../trade-generator'
import { computeTicker } from '../ticker-process'
import {
  cancelLimit,
  tickRestingAgainstMid,
} from './matching-engine'
import {
  createAccountState,
  getRestingForSymbol,
  setRestingForSymbol,
  applyFillToPosition,
} from './account-state'
import { createConnectionFsm } from './connection-fsm'
import { createMockHistoryReader } from './mock-history-reader'
import { createMockLeverageMargin } from './mock-leverage-margin'
import { createMockPositionProtection } from './mock-position-protection'
import { createMockOrderPlacement } from './mock-order-placement'
import { createMockOrderValidation } from './mock-order-validation'
import { subscribePortfolioSnapshot, generatePortfolioHistory } from './portfolio-process'
import { ANCHOR_PRICES, MARKETS } from '../mock-venue.constants'
import {
  currentTimestamp,
  samplePoisson,
  createBookState,
  updateBookState,
  sampleAckLatencyMilliseconds,
  delayMilliseconds,
} from '../mock-venue.utils'
import type {
  BookState,
  MockVenueOptions,
} from '../mock-venue.types'

const SEED = 42
const SNAPSHOT_INTERVAL_MILLISECONDS = 30_000
const DIFF_INTERVAL_MILLISECONDS = 100
const TRADE_INTERVAL_MILLISECONDS = 500
const TICKER_INTERVAL_MILLISECONDS = 1000
const POISSON_ARRIVAL_RATE = 2

let identifierCounter = 0
function nextIdentifier(prefix: string): string {
  identifierCounter += 1
  return `${prefix}-${Date.now()}-${identifierCounter}`
}

const MOCK_EQUITY_BUCKETS: ReadonlyArray<EquityExtensionBucket> = [
  { key: 'vault', label: 'Vault Equity', amountUsd: 1_500, hint: 'incl. uPNL' },
  { key: 'earn', label: 'Earn Balance', amountUsd: 750 },
  { key: 'staking', label: 'Staking Account', amountUsd: 250 },
]

// Funded segregated account mirroring the reference numbers so the equity card's
// derived rows + health badge render in dev (a = 300.07, b = 8.85 → 33.91x;
// maintenance 3.75 / 8.85 → 42.37%).
const MOCK_MARGIN_SUMMARY: MarginSummarySnapshot = {
  maintenanceMarginUsd: 3.75,
  accountLeverage: 33.91,
  marginRatioPct: 42.37,
  unrealizedPnlUsd: 0.29,
  totalCrossPositionsValueUsd: 300.07,
  crossAccountValueUsd: 8.85,
}

const MOCK_FEE_SCHEDULE: FeeSchedule = {
  currentTierKey: 'tier-1',
  tiers: [
    { key: 'tier-1', label: 'Tier 1', takerBps: 4.5, makerBps: 1.5, hint: '< $5M / 14d' },
    { key: 'tier-2', label: 'Tier 2', takerBps: 4.0, makerBps: 1.2 },
    { key: 'tier-3', label: 'Tier 3', takerBps: 3.5, makerBps: 1.0 },
  ],
  volumeTiers: [
    { key: 'tier-0', label: '0', notionalCutoff: 5_000_000, perpsTaker: 0.00045, perpsMaker: 0.00015, spotTaker: 0.0007, spotMaker: 0.0004 },
    { key: 'tier-1', label: '1', notionalCutoff: 25_000_000, perpsTaker: 0.0004, perpsMaker: 0.00012, spotTaker: 0.0006, spotMaker: 0.0003 },
  ],
  makerRebateTiers: [],
  stakingDiscountTiers: [
    { bpsOfMaxSupply: 1, discount: 0.05 },
    { bpsOfMaxSupply: 5, discount: 0.1 },
  ],
  referralDiscount: 0.04,
  activeReferralDiscount: 0,
  activeStakingDiscount: { bpsOfMaxSupply: 0, discount: 0 },
  userPerpsTakerRate: 0.00045,
  userPerpsMakerRate: 0.00015,
  userSpotTakerRate: 0.0007,
  userSpotMakerRate: 0.0004,
}

const MOCK_BALANCES_SPOT: ReadonlyArray<Balance> = [
  { asset: 'USDC', amount: 5_000, available: 5_000, amountUsd: 5_000, pnlPct: null, source: 'spot' },
  { asset: 'BTC', amount: 0.05, available: 0.05, amountUsd: 3_000, pnlPct: 12.4, source: 'spot' },
  { asset: 'ETH', amount: 1.2, available: 1.0, amountUsd: 2_400, pnlPct: -3.2, source: 'spot' },
]

const MOCK_BALANCES_PERPS: ReadonlyArray<Balance> = [
  { asset: 'USDC', amount: 1_200, available: 900, amountUsd: 1_200, pnlPct: 4.5, source: 'perps' },
]

const MOCK_OPEN_ORDERS_SNAPSHOT: ReadonlyArray<Order> = [
  {
    identifier: 'mock-oo-1',
    symbol: 'BTC',
    side: 'buy',
    price: 60_000,
    size: 0.1,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_000_000,
  },
  {
    identifier: 'mock-oo-2',
    symbol: 'BTC',
    side: 'sell',
    price: 65_000,
    size: 0.1,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_001_000,
  },
  {
    identifier: 'mock-oo-3',
    symbol: 'ETH',
    side: 'buy',
    price: 3_400,
    size: 1.5,
    filledSize: 0.25,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_002_000,
  },
  {
    identifier: 'mock-oo-4',
    symbol: 'ETH',
    side: 'sell',
    price: 3_650,
    size: 0.75,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_003_000,
  },
  {
    identifier: 'mock-oo-5',
    symbol: 'SOL',
    side: 'buy',
    price: 150,
    size: 10,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_004_000,
  },
]

const MOCK_TWAP_ACTIVE_SNAPSHOT: ReadonlyArray<ActiveTwap> = [
  {
    identifier: 'mock-twap-active-1',
    symbol: 'BTC',
    side: 'buy',
    size: 0.5,
    executedSize: 0.2,
    executedNotionalUsd: 12_000,
    durationMinutes: 60,
    reduceOnly: false,
    randomize: true,
    createdAt: 1_700_000_000_000,
  },
  {
    identifier: 'mock-twap-active-2',
    symbol: 'ETH',
    side: 'sell',
    size: 5,
    executedSize: 1,
    executedNotionalUsd: 3_400,
    durationMinutes: 30,
    reduceOnly: true,
    randomize: false,
    createdAt: 1_700_000_100_000,
  },
]

const MOCK_TWAP_HISTORY: ReadonlyArray<TwapHistoryEntry> = [
  {
    identifier: 'mock-twap-hist-1',
    symbol: 'BTC',
    side: 'buy',
    size: 0.4,
    executedSize: 0.4,
    executedNotionalUsd: 24_000,
    status: 'finished',
    createdAt: 1_699_900_000_000,
    endedAt: 1_699_903_600_000,
    durationMinutes: 60,
    reduceOnly: false,
    randomize: true,
  },
  {
    identifier: 'mock-twap-hist-2',
    symbol: 'ETH',
    side: 'sell',
    size: 10,
    executedSize: 7.5,
    executedNotionalUsd: 25_500,
    status: 'terminated',
    createdAt: 1_699_910_000_000,
    endedAt: 1_699_911_500_000,
  },
  {
    identifier: 'mock-twap-hist-3',
    symbol: 'SOL',
    side: 'buy',
    size: 50,
    executedSize: 0,
    executedNotionalUsd: 0,
    status: 'error',
    createdAt: 1_699_920_000_000,
    endedAt: 1_699_920_300_000,
  },
]

const MOCK_TRADE_HISTORY: ReadonlyArray<Fill> = [
  {
    identifier: 'mock-fill-1',
    orderIdentifier: 'mock-order-1',
    symbol: 'BTC',
    side: 'buy',
    price: 60_500,
    size: 0.05,
    fee: 1.21,
    timestamp: 1_699_950_000_000,
    closedPnl: 0,
    direction: 'Open Long',
    crossed: true,
    feeToken: 'USDC',
  },
  {
    identifier: 'mock-fill-2',
    orderIdentifier: 'mock-order-2',
    symbol: 'ETH',
    side: 'sell',
    price: 3_400,
    size: 1.5,
    fee: 2.55,
    timestamp: 1_699_950_300_000,
    closedPnl: 128.4,
    direction: 'Close Long',
    crossed: false,
    feeToken: 'USDC',
  },
  {
    identifier: 'mock-fill-3',
    orderIdentifier: 'mock-order-3',
    symbol: 'SOL',
    side: 'buy',
    price: 145.5,
    size: 20,
    fee: 0.87,
    timestamp: 1_699_950_600_000,
    closedPnl: 0,
    direction: 'Open Long',
  },
]

const MOCK_TWAP_SLICE_FILLS: ReadonlyArray<Fill> = [
  {
    identifier: 'mock-twap-slice-1',
    orderIdentifier: 'mock-twap-1',
    symbol: 'BTC',
    side: 'buy',
    price: 60_400,
    size: 0.01,
    fee: 0.24,
    timestamp: 1_699_950_120_000,
    closedPnl: 0,
    direction: 'Open Long',
    crossed: true,
    feeToken: 'USDC',
  },
  {
    identifier: 'mock-twap-slice-2',
    orderIdentifier: 'mock-twap-1',
    symbol: 'BTC',
    side: 'buy',
    price: 60_450,
    size: 0.01,
    fee: 0.24,
    timestamp: 1_699_950_180_000,
    closedPnl: 0,
    direction: 'Open Long',
    crossed: false,
    feeToken: 'USDC',
  },
]

const MOCK_ORDER_HISTORY: ReadonlyArray<HistoricalOrder> = [
  {
    identifier: 'mock-hist-order-1',
    symbol: 'BTC',
    side: 'buy',
    price: 60_000,
    size: 0.1,
    originalSize: 0.1,
    orderType: 'Limit',
    timeInForce: 'Gtc',
    reduceOnly: false,
    isTrigger: false,
    triggerPrice: 0,
    status: 'filled',
    createdAt: 1_699_949_000_000,
    statusTimestamp: 1_699_950_000_000,
  },
  {
    identifier: 'mock-hist-order-2',
    symbol: 'ETH',
    side: 'sell',
    price: 3_500,
    size: 1.5,
    originalSize: 1.5,
    orderType: 'Limit',
    timeInForce: 'Gtc',
    reduceOnly: false,
    isTrigger: false,
    triggerPrice: 0,
    status: 'canceled',
    createdAt: 1_699_955_000_000,
    statusTimestamp: 1_699_956_000_000,
  },
  {
    identifier: 'mock-hist-order-3',
    symbol: 'SOL',
    side: 'buy',
    price: 0,
    size: 20,
    originalSize: 20,
    orderType: 'Market',
    timeInForce: 'FrontendMarket',
    reduceOnly: false,
    isTrigger: false,
    triggerPrice: 0,
    status: 'rejected',
    createdAt: 1_699_960_000_000,
    statusTimestamp: 1_699_960_100_000,
  },
]

const MOCK_FUNDING_HISTORY: ReadonlyArray<FundingHistoryEntry> = [
  {
    symbol: 'BTC',
    amountUsd: -1.25,
    fundingRate: 0.0000417,
    positionSize: 0.1,
    timestamp: 1_699_948_000_000,
  },
  {
    symbol: 'ETH',
    amountUsd: 0.42,
    fundingRate: -0.0000125,
    positionSize: -1.5,
    timestamp: 1_699_954_000_000,
  },
  {
    symbol: 'SOL',
    amountUsd: -0.18,
    fundingRate: 0.0000333,
    positionSize: 20,
    timestamp: 1_699_961_000_000,
  },
]

const MOCK_INTEREST_HISTORY: ReadonlyArray<InterestHistoryEntry> = [
  { asset: 'USDC', amountUsd: 1.23, timestamp: 1_699_948_000_000 },
  { asset: 'USDC', amountUsd: -0.42, timestamp: 1_699_954_000_000 },
  { asset: 'ETH', amountUsd: 0.005, timestamp: 1_699_961_000_000 },
]

const MOCK_ACCOUNT_ACTIVITY: ReadonlyArray<AccountActivityEntry> = [
  {
    time: 1_699_948_000_000,
    hash: '0xaa00000000000000000000000000000000000000000000000000000000000001',
    delta: { type: 'deposit', usdc: '1500.00' },
  },
  {
    time: 1_699_954_000_000,
    hash: '0xaa00000000000000000000000000000000000000000000000000000000000002',
    delta: {
      type: 'accountClassTransfer',
      usdc: '250.00',
      toPerp: true,
    },
  },
  {
    time: 1_699_961_000_000,
    hash: '0xaa00000000000000000000000000000000000000000000000000000000000003',
    delta: { type: 'withdraw', usdc: '100.00', nonce: 1, fee: '1.00' },
  },
]

const MOCK_PERPS_POSITIONS_SNAPSHOT: ReadonlyArray<PerpPositionSnapshot> = [
  {
    symbol: 'BTC',
    side: 'long',
    size: 0.1,
    entryPrice: 60_000,
    markPrice: 61_000,
    positionValueUsd: 6_100,
    unrealizedPnlUsd: 100,
    roePct: 31.63,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 54_000,
    marginUsedUsd: 600,
  },
]

export function createMockVenue(options: MockVenueOptions = {}): Venue {
  const rng = options.rng ?? Math.random
  const bookStateMap = new Map<string, BookState>()
  const previousMidBySymbol = new Map<string, number>()
  const accountState = createAccountState()
  const leverageMargin = createMockLeverageMargin({
    maxLeverageFor: (symbol) => MARKETS.find((m) => m.symbol === symbol)?.maxLeverage ?? null,
    isKnownSymbol: (symbol) => MARKETS.some((m) => m.symbol === symbol),
  })
  const positionProtectionState = createMockPositionProtection({
    isKnownSymbol: (symbol) => MARKETS.some((m) => m.symbol === symbol),
    hasPosition: (symbol) => accountState.positionsBySymbol.has(symbol),
  })
  const fillListeners = new Set<(fill: Fill) => void>()
  const orderListeners = new Set<(order: Order) => void>()
  const positionListeners = new Set<(position: Position) => void>()
  const tradeListenersBySymbol = new Map<string, Set<(update: TradesUpdate) => void>>()
  const connectionStatusListeners = new Set<(status: ConnectionStatus) => void>()
  const orderbookListenersBySymbol = new Map<
    string,
    Set<(update: OrderbookUpdate) => void>
  >()
  const orderbookSequenceBySymbol = new Map<string, number>()

  const fsm = createConnectionFsm({
    rng,
    onChange: (fsmStatus) => {
      const status: ConnectionStatus = fsmStatus
      for (const listener of connectionStatusListeners) listener(status)
      const isReconnected = fsmStatus === 'connected'
      if (isReconnected) {
        replayFreshSnapshotsToAllSubscribers()
      }
    },
  })

  function replayFreshSnapshotsToAllSubscribers(): void {
    for (const [symbol, listeners] of orderbookListenersBySymbol) {
      const currentSequence = orderbookSequenceBySymbol.get(symbol) ?? 1
      const time = currentTimestamp()
      const snapshot = generateSnapshot(symbol, SEED, time, currentSequence)
      orderbookSequenceBySymbol.set(symbol, currentSequence + 1)
      const currentState = getOrCreateBookState(symbol)
      const nextState = updateBookState(currentState, snapshot)
      bookStateMap.set(symbol, nextState)
      const hasMid = nextState.lastMidPrice > 0
      if (hasMid) {
        processBookTickForCrosses(symbol, nextState.lastMidPrice, snapshot.timestamp)
      }
      for (const listener of listeners) listener(snapshot)
    }
  }

  function emitFill(fill: Fill): void {
    for (const listener of fillListeners) listener(fill)
  }
  function emitOrder(order: Order): void {
    for (const listener of orderListeners) listener(order)
  }
  function emitPosition(position: Position): void {
    for (const listener of positionListeners) listener(position)
  }
  function broadcastTradeFromFill(fill: Fill): void {
    const tradeListeners = tradeListenersBySymbol.get(fill.symbol)
    if (!tradeListeners) return
    const trade: Trade = {
      identifier: fill.identifier,
      symbol: fill.symbol,
      side: fill.side,
      price: fill.price,
      size: fill.size,
      timestamp: fill.timestamp,
    }
    // A fill prints live, after the subscribe-time snapshot — an `append`. ADR-0030.
    for (const listener of tradeListeners) listener({ kind: 'append', trade })
  }

  function emitRestingTriggerOrder(
    request: StopMarketOrderRequest | StopLimitOrderRequest,
    orderIdentifier: string,
    timestamp: number,
  ): void {
    // A stop is recorded as a resting open order awaiting its trigger. The mock
    // does not simulate the trigger fill (ADR-0034 D-4: minimal sim). The
    // recorded price is the post-trigger resting price for stop-limit, or the
    // stop price itself for stop-market (which fills at market on trigger).
    const isStopLimit = request.orderType === 'stop-limit'
    const restingPrice = isStopLimit ? request.price : request.stopPrice
    const comparator = request.side === 'buy' ? '≥' : '≤'
    const order: Order = {
      identifier: orderIdentifier,
      symbol: request.symbol,
      side: request.side,
      price: restingPrice,
      size: request.size,
      filledSize: 0,
      status: 'open',
      orderType: 'limit',
      timestamp,
      originalSize: request.size,
      reduceOnly: request.reduceOnly,
      triggerConditions: `Price ${comparator} ${request.stopPrice}`,
    }
    accountState.ordersByIdentifier.set(orderIdentifier, order)
    emitOrder(order)
  }

  function getOrCreateBookState(symbol: string): BookState {
    const existing = bookStateMap.get(symbol)
    if (existing !== undefined) return existing
    const initial = createBookState()
    bookStateMap.set(symbol, initial)
    return initial
  }

  function leverageFor(symbol: string): number {
    // A leverage explicitly set via the controller wins; otherwise fall back to
    // the open position's leverage, then to the controller default (1×).
    const existing = accountState.positionsBySymbol.get(symbol)
    return existing?.leverage ?? leverageMargin.leverageFor(symbol)
  }

  function processBookTickForCrosses(symbol: string, nextMid: number, timestamp: number): void {
    const previousMid = previousMidBySymbol.get(symbol) ?? 0
    previousMidBySymbol.set(symbol, nextMid)
    const resting = getRestingForSymbol(accountState, symbol)
    const hasResting = resting.length > 0
    if (!hasResting) return
    const result = tickRestingAgainstMid(
      previousMid,
      nextMid,
      resting,
      () => nextIdentifier('fill'),
      timestamp,
    )
    setRestingForSymbol(accountState, symbol, result.remaining)
    for (const filledOrder of result.filledOrders) {
      const order = accountState.ordersByIdentifier.get(filledOrder.identifier)
      const updatedOrder: Order = order
        ? { ...order, filledSize: order.size, status: 'filled', timestamp }
        : {
            identifier: filledOrder.identifier,
            symbol: filledOrder.symbol,
            side: filledOrder.side,
            price: filledOrder.price,
            size: filledOrder.size,
            filledSize: filledOrder.size,
            status: 'filled',
            orderType: 'limit',
            timestamp,
          }
      accountState.ordersByIdentifier.set(filledOrder.identifier, updatedOrder)
      emitOrder(updatedOrder)
    }
    for (const fill of result.fills) {
      accountState.fills.push(fill)
      const position = applyFillToPosition(accountState, fill, leverageFor(fill.symbol))
      emitFill(fill)
      broadcastTradeFromFill(fill)
      emitPosition(position)
    }
  }

  const { fillMarketOrder, placeLimitOrder } = createMockOrderPlacement({
    accountState,
    bookStateMap,
    nextIdentifier,
    leverageFor,
    emitOrder,
    emitFill,
    emitPosition,
    broadcastTradeFromFill,
  })

  // Available margin the mock account can open against (perps USDC `available`).
  const MOCK_AVAILABLE_MARGIN_USD = 900

  function markPriceFor(symbol: string): number {
    // Prefer the live book mid (populated once the orderbook is subscribed);
    // fall back to the static anchor so validation/preview works before any
    // book tick.
    const liveMid = bookStateMap.get(symbol)?.lastMidPrice ?? 0
    if (liveMid > 0) return liveMid
    return ANCHOR_PRICES[symbol] ?? 0
  }

  const orderValidation = createMockOrderValidation({
    // The draft is self-describing (ADR-0057) — the venue resolves the market
    // from `draft.symbol`, so no active-symbol resolver is injected.
    markPriceFor,
    availableMarginFor: () => MOCK_AVAILABLE_MARGIN_USD,
  })

  const connection: ConnectionStatusSource = {
    status(): ConnectionStatus {
      return fsm.status()
    },
    subscribe(onChange: (status: ConnectionStatus) => void): Unsubscribe {
      connectionStatusListeners.add(onChange)
      onChange(fsm.status())
      return () => {
        connectionStatusListeners.delete(onChange)
      }
    },
  }

  const marketsSnapshot: Market[] = [...MARKETS]
  const marketData: MarketDataReader = {
    // Mock markets are synchronously generated at venue construction; there
    // is no remote source to (re)load, so refresh is a satisfied no-op.
    async refresh(): Promise<void> {},
    listMarkets(): Market[] {
      return marketsSnapshot
    },
    subscribeMarkets(onChange: (markets: Market[]) => void): Unsubscribe {
      onChange(marketsSnapshot)
      return () => {}
    },
    subscribeOrderbook(
      symbol: string,
      onUpdate: (update: OrderbookUpdate) => void,
      // mock-venue ignores the display-tick hint — it generates its own
      // synthetic depth. Real venue adapters (HL) consume `opts.tick` to
      // request server-side aggregation (HL `nSigFigs`).
    ): Unsubscribe {
      const existingListeners = orderbookListenersBySymbol.get(symbol) ?? new Set()
      existingListeners.add(onUpdate)
      orderbookListenersBySymbol.set(symbol, existingListeners)

      let sequence = orderbookSequenceBySymbol.get(symbol) ?? 1

      const handleUpdate = (update: OrderbookUpdate) => {
        const isReconnecting = fsm.status() === 'reconnecting'
        if (isReconnecting) return
        const currentState = getOrCreateBookState(symbol)
        const nextState = updateBookState(currentState, update)
        bookStateMap.set(symbol, nextState)
        const hasMid = nextState.lastMidPrice > 0
        if (hasMid) {
          processBookTickForCrosses(symbol, nextState.lastMidPrice, update.timestamp)
        }
        onUpdate(update)
      }

      const emitSnapshot = () => {
        const time = currentTimestamp()
        const snapshot = generateSnapshot(symbol, SEED, time, sequence)
        orderbookSequenceBySymbol.set(symbol, sequence + 1)
        sequence += 1
        handleUpdate(snapshot)
      }

      const emitDiff = () => {
        const time = currentTimestamp()
        const diff = generateDiff(symbol, SEED, time, sequence)
        orderbookSequenceBySymbol.set(symbol, sequence + 1)
        sequence += 1
        handleUpdate(diff)
      }

      emitSnapshot()
      const snapshotTimer = setInterval(emitSnapshot, SNAPSHOT_INTERVAL_MILLISECONDS)
      const diffTimer = setInterval(emitDiff, DIFF_INTERVAL_MILLISECONDS)

      return () => {
        clearInterval(snapshotTimer)
        clearInterval(diffTimer)
        const listeners = orderbookListenersBySymbol.get(symbol)
        if (listeners) listeners.delete(onUpdate)
      }
    },
    subscribeTrades(symbol: string, onUpdate: (update: TradesUpdate) => void): Unsubscribe {
      let tradeCounter = 0
      const listenersForSymbol = tradeListenersBySymbol.get(symbol) ?? new Set()
      listenersForSymbol.add(onUpdate)
      tradeListenersBySymbol.set(symbol, listenersForSymbol)

      // Emit the readiness snapshot synchronously. The mock has no historical
      // trades feed, so it is empty — the tape resolves to "no recent trades"
      // until live trades print as appends. See ADR-0030.
      onUpdate({ kind: 'snapshot', trades: [] })

      const emitTrades = () => {
        const isReconnecting = fsm.status() === 'reconnecting'
        if (isReconnecting) return

        const bookState = bookStateMap.get(symbol)
        const isBookReady =
          bookState !== undefined && bookState.bids.length > 0 && bookState.asks.length > 0
        if (!isBookReady) return

        const time = currentTimestamp()
        const tradeSeed = SEED ^ (time >>> 10) ^ (tradeCounter * 7919)
        const random = (() => {
          let state = tradeSeed >>> 0
          return () => {
            state = (state + 0x6d2b79f5) | 0
            let z = state
            z = Math.imul(z ^ (z >>> 15), z | 1)
            z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
            return ((z ^ (z >>> 14)) >>> 0) / 0x100000000
          }
        })()

        const count = samplePoisson(
          random,
          POISSON_ARRIVAL_RATE * (TRADE_INTERVAL_MILLISECONDS / 1000),
        )
        for (let index = 0; index < count; index++) {
          const trade = generateTrade(
            symbol,
            bookState.bids,
            bookState.asks,
            tradeSeed ^ (index * 31337),
            time + index,
            bookState.recentPriceDrift,
          )
          tradeCounter += 1
          onUpdate({ kind: 'append', trade })
        }
      }

      const tradeTimer = setInterval(emitTrades, TRADE_INTERVAL_MILLISECONDS)

      return () => {
        clearInterval(tradeTimer)
        const listeners = tradeListenersBySymbol.get(symbol)
        if (listeners) listeners.delete(onUpdate)
      }
    },
    subscribeTicker(symbol: string, onTicker: (ticker: Ticker) => void): Unsubscribe {
      const emitTicker = () => {
        const isReconnecting = fsm.status() === 'reconnecting'
        if (isReconnecting) return
        const time = currentTimestamp()
        const ticker = computeTicker(symbol, SEED, time)
        onTicker(ticker)
      }

      emitTicker()
      const tickerTimer = setInterval(emitTicker, TICKER_INTERVAL_MILLISECONDS)

      return () => {
        clearInterval(tickerTimer)
      }
    },
  }

  const positions: PositionsReader = {
    subscribe(onPosition: (position: Position) => void): Unsubscribe {
      positionListeners.add(onPosition)
      return () => {
        positionListeners.delete(onPosition)
      }
    },
  }

  const perpsPositionsSnapshot: PerpsPositionsSnapshotReader = {
    subscribe(onUpdate) {
      onUpdate(MOCK_PERPS_POSITIONS_SNAPSHOT)
      return () => {}
    },
  }

  const openOrdersSnapshot: OpenOrdersSnapshotReader = {
    subscribe(onUpdate) {
      onUpdate(MOCK_OPEN_ORDERS_SNAPSHOT)
      return () => {}
    },
  }

  const twapActiveSnapshot: TwapActiveSnapshotReader = {
    subscribe(onUpdate) {
      onUpdate(MOCK_TWAP_ACTIVE_SNAPSHOT)
      return () => {}
    },
  }

  const twapHistory: TwapHistoryReader = createMockHistoryReader(MOCK_TWAP_HISTORY)
  const twapSliceFills: TwapSliceFillsReader = createMockHistoryReader(MOCK_TWAP_SLICE_FILLS)
  // No-op TWAP cancel controller (ADR-0052 D-4) — exercises the dock's cancel
  // flow offline without a network call.
  const twapController: TwapController = {
    cancelTwap: () => okAsync(undefined),
    cancelAll: () => okAsync([]),
  }
  const tradeHistory: TradeHistoryReader = createMockHistoryReader(MOCK_TRADE_HISTORY)
  const fundingHistory: FundingHistoryReader = createMockHistoryReader(MOCK_FUNDING_HISTORY)
  const orderHistory: OrderHistoryReader = createMockHistoryReader(MOCK_ORDER_HISTORY)
  const interestHistory: InterestHistoryReader = createMockHistoryReader(MOCK_INTEREST_HISTORY)
  const accountActivity: AccountActivityReader = createMockHistoryReader(MOCK_ACCOUNT_ACTIVITY)

  const openOrders: OpenOrdersReader = {
    subscribe(onOrder: (order: Order) => void): Unsubscribe {
      orderListeners.add(onOrder)
      return () => {
        orderListeners.delete(onOrder)
      }
    },
  }

  const fills: FillsReader = {
    subscribe(onFill: (fill: Fill) => void): Unsubscribe {
      fillListeners.add(onFill)
      return () => {
        fillListeners.delete(onFill)
      }
    },
  }

  const trader: Trader = {
    supportsTriggerOrders: true,
    // ADR-0034 D-4: the mock advertises and minimally simulates Stop Market /
    // Stop Limit / TWAP so every Pro order-type flow is demoable + testable
    // without live Hyperliquid. Stops are recorded as resting/triggerable
    // orders (reflected in the open-orders stream); a TWAP is acknowledged as
    // an accepted, running order. Market/Limit behaviour is byte-identical.
    supportsStopOrders: true,
    supportsTwap: true,
    placeOrder(request: PlaceOrderRequest): ResultAsync<PlaceOrderOutcome, PlaceOrderError> {
      const isSizeInvalid = !(request.size > 0)
      if (isSizeInvalid) {
        return errAsync(new PlaceOrderError('invalid-size', 'size must be > 0'))
      }
      const isLimit = request.orderType === 'limit'
      const isLimitPriceInvalid = isLimit && !(request.price > 0)
      if (isLimitPriceInvalid) {
        return errAsync(new PlaceOrderError('invalid-price', 'limit price must be > 0'))
      }
      const isStop = request.orderType === 'stop-market' || request.orderType === 'stop-limit'
      const isStopPriceInvalid = isStop && !(request.stopPrice > 0)
      if (isStopPriceInvalid) {
        return errAsync(new PlaceOrderError('invalid-price', 'stop price must be > 0'))
      }
      const isTwap = request.orderType === 'twap'
      const isTwapDurationInvalid = isTwap && !(request.durationMinutes > 0)
      if (isTwapDurationInvalid) {
        return errAsync(new PlaceOrderError('invalid-size', 'twap duration must be > 0'))
      }
      const symbolKnown = MARKETS.some((market) => market.symbol === request.symbol)
      if (!symbolKnown) {
        return errAsync(new PlaceOrderError('unknown-symbol', `unknown symbol ${request.symbol}`))
      }

      const orderIdentifier = nextIdentifier('order')
      const acknowledgedAt = currentTimestamp()
      const latencyMilliseconds = sampleAckLatencyMilliseconds(rng)

      const outcomePromise = delayMilliseconds(latencyMilliseconds).then((): PlaceOrderOutcome => {
        const base = {
          orderIdentifier,
          clientOrderId: request.clientOrderId,
          symbol: request.symbol,
          timestamp: acknowledgedAt,
        }
        if (isLimit) {
          placeLimitOrder(request, orderIdentifier, acknowledgedAt)
          return { ...base, kind: 'resting' }
        }
        // A stop rests until its trigger fires; the mock does not simulate the
        // trigger fill, but it emits the order so the open-orders stream
        // reflects the resting trigger order. A TWAP is acknowledged as an
        // accepted, running order — also a `resting` outcome.
        const isStopMarket = request.orderType === 'stop-market'
        const isStopLimit = request.orderType === 'stop-limit'
        if (isStopMarket || isStopLimit) {
          emitRestingTriggerOrder(request, orderIdentifier, acknowledgedAt)
          return { ...base, kind: 'resting' }
        }
        if (request.orderType === 'twap') {
          return { ...base, kind: 'resting' }
        }
        const fillError = fillMarketOrder(request, orderIdentifier, acknowledgedAt)
        if (fillError !== null) throw fillError
        const filledOrder = accountState.ordersByIdentifier.get(orderIdentifier)
        const averagePrice = filledOrder?.price ?? 0
        return { ...base, kind: 'filled', averagePrice, filledSize: request.size }
      })

      return ResultAsync.fromPromise(outcomePromise, (error) =>
        error instanceof PlaceOrderError ? error : new PlaceOrderError('book-empty', String(error)),
      )
    },
    modifyOrder(request: ModifyOrderRequest): ResultAsync<PlaceOrderOutcome, ModifyOrderError> {
      const order = accountState.ordersByIdentifier.get(request.identifier)
      const isUnknownOrder = !order || order.status !== 'open'
      if (isUnknownOrder) {
        return errAsync(
          new ModifyOrderError('not-found', `resting order ${request.identifier} not found`),
        )
      }
      const hasInvalidSize = request.size !== undefined && !(request.size > 0)
      if (hasInvalidSize) {
        return errAsync(new ModifyOrderError('invalid-size', 'size must be > 0'))
      }
      const hasInvalidPrice = request.price !== undefined && !(request.price > 0)
      if (hasInvalidPrice) {
        return errAsync(new ModifyOrderError('invalid-price', 'price must be > 0'))
      }

      const nextPrice = request.price ?? order.price
      const nextSize = request.size ?? order.size
      const latencyMilliseconds = sampleAckLatencyMilliseconds(rng)

      const modifyPromise = delayMilliseconds(latencyMilliseconds).then((): PlaceOrderOutcome => {
        const timestamp = currentTimestamp()
        const modifiedOrder: Order = { ...order, price: nextPrice, size: nextSize, timestamp }
        accountState.ordersByIdentifier.set(request.identifier, modifiedOrder)
        const previousResting = getRestingForSymbol(accountState, order.symbol)
        const nextResting = previousResting.map((resting) =>
          resting.identifier === request.identifier
            ? { ...resting, price: nextPrice, size: nextSize, timestamp }
            : resting,
        )
        setRestingForSymbol(accountState, order.symbol, nextResting)
        emitOrder(modifiedOrder)
        return {
          kind: 'resting',
          orderIdentifier: request.identifier,
          symbol: order.symbol,
          timestamp,
        }
      })

      return ResultAsync.fromPromise(
        modifyPromise,
        (error) => new ModifyOrderError('rejected', String(error)),
      )
    },
    // ADR-0035 D-1: venue-owned validation + preview. The mock parses the
    // raw-string draft into a `PlaceOrderRequest` (or field-tagged issues) and
    // prices plausible estimates + capacity. Synchronous (`Result`, not
    // `ResultAsync`) — every input is in-memory.
    validateDraft: orderValidation.validateDraft,
    previewOrder: orderValidation.previewOrder,
    cancelOrder(identifier: OrderIdentifier): ResultAsync<void, CancelOrderError> {
      const order = accountState.ordersByIdentifier.get(identifier)
      if (!order) {
        return errAsync(new CancelOrderError('not-found', `order ${identifier} not found`))
      }

      const latencyMilliseconds = sampleAckLatencyMilliseconds(rng)

      const cancelPromise = delayMilliseconds(latencyMilliseconds).then(() => {
        const previousResting = getRestingForSymbol(accountState, order.symbol)
        setRestingForSymbol(accountState, order.symbol, cancelLimit(previousResting, identifier))
        const cancelledOrder: Order = {
          ...order,
          status: 'cancelled',
          timestamp: currentTimestamp(),
        }
        accountState.ordersByIdentifier.set(identifier, cancelledOrder)
        emitOrder(cancelledOrder)
      })

      return ResultAsync.fromPromise(
        cancelPromise,
        (error) => new CancelOrderError('not-found', String(error)),
      )
    },
  }

  const candles: CandlesReader = {
    getHistory(
      symbol: string,
      interval: Interval,
      count?: number,
    ): Result<Candle[], CandleError> {
      return getHistory(symbol, interval, count)
    },
    loadOlder(symbol, interval, beforeOpenTime, count) {
      return loadOlderCandles(symbol, interval, beforeOpenTime, count)
    },
    subscribe(
      symbol: string,
      interval: Interval,
      onUpdate: (update: CandleUpdate) => void,
    ): Unsubscribe {
      return subscribeCandleStream(symbol, interval, onUpdate)
    },
  }

  const portfolio: PortfolioReader = {
    subscribeSnapshot(
      scope: PortfolioAccountScope,
      onUpdate: (snapshot: PortfolioSnapshot) => void,
    ): Unsubscribe {
      return subscribePortfolioSnapshot(scope, onUpdate, { seed: SEED })
    },
    getHistory(
      metric: PortfolioMetric,
      window: PortfolioWindow,
      scope: PortfolioAccountScope,
    ): ResultAsync<PortfolioPoint[], PortfolioHistoryError> {
      const points = generatePortfolioHistory(metric, window, scope, { seed: SEED })
      return okAsync(points)
    },
  }

  const equityExtensions: EquityExtensionsReader = {
    subscribe(
      _scope: PortfolioAccountScope,
      onUpdate: (buckets: ReadonlyArray<EquityExtensionBucket>) => void,
    ): Unsubscribe {
      onUpdate(MOCK_EQUITY_BUCKETS)
      return () => {}
    },
  }

  const marginSummary: MarginSummaryReader = {
    subscribe(onUpdate: (snapshot: MarginSummarySnapshot) => void): Unsubscribe {
      onUpdate(MOCK_MARGIN_SUMMARY)
      return () => {}
    },
  }

  const feeSchedule: FeeScheduleReader = {
    subscribe(onUpdate: (schedule: FeeSchedule) => void): Unsubscribe {
      onUpdate(MOCK_FEE_SCHEDULE)
      return () => {}
    },
  }

  const balances: BalancesReader = {
    subscribe(
      scope: PortfolioAccountScope,
      onUpdate: (next: ReadonlyArray<Balance>) => void,
    ): Unsubscribe {
      onUpdate(scope === 'perps' ? MOCK_BALANCES_PERPS : MOCK_BALANCES_SPOT)
      return () => {}
    },
  }

  // The mock venue has no account abstraction modes — always classic segregated
  // Spot/Perp, so Transfer applies and balances render in the segregated view.
  const accountMode: AccountModeReader = {
    current: () => ({ isSegregated: true }),
    subscribe(onChange: (mode: AccountMode) => void): Unsubscribe {
      onChange({ isSegregated: true })
      return () => {}
    },
  }

  // Silence: PortfolioHistoryError unused at runtime in mock; kept on the
  // import for symmetry with the capability surface (re-export point).
  void PortfolioHistoryError

  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection,
      marketData,
      positions,
      openOrders,
      openOrdersSnapshot,
      twapActiveSnapshot,
      twapHistory,
      twapSliceFills,
      twapController,
      tradeHistory,
      fundingHistory,
      orderHistory,
      interestHistory,
      accountActivity,
      fills,
      trader,
      leverageController: leverageMargin.leverageController,
      marginModeController: leverageMargin.marginModeController,
      positionProtection: positionProtectionState.positionProtection,
      candles,
      portfolio,
      equityExtensions,
      marginSummary,
      feeSchedule,
      balances,
      accountMode,
      perpsPositionsSnapshot,
      // mock-venue has no address concept (no spectate), so the order-flow
      // `ownAccount` group simply ALIASES the same readers the viewing
      // capabilities use — acting === viewing (ADR-0038 D-5).
      ownAccount: {
        portfolio,
        balances,
        perpsPositionsSnapshot,
        feeSchedule,
        accountMode,
      },
    },
  }
}
