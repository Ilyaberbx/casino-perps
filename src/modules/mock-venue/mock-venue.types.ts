import type { Result, ResultAsync } from 'neverthrow'
import type {
  Fill,
  Order,
  OrderIdentifier,
  OrderbookLevel,
  Position,
  Side,
  Unsubscribe,
  PortfolioHistoryFetchError,
  PlaceOrderRequest,
  LimitOrderRequest,
  PlaceOrderError,
  OrderDraft,
  OrderIssue,
  OrderEstimates,
  OrderCapacity,
} from '../shared/domain'

/**
 * The placement seam no longer reads leverage off the request (the domain
 * `PlaceOrderRequest` dropped its `leverage` field — PRD decision 12). The
 * venue closure resolves the effective leverage per symbol and threads it in.
 */
export type LeverageFor = (symbol: string) => number

/**
 * Shape shared by every mock history reader (twap/trade/funding/order/interest/
 * account-activity history). One-shot: the first `loadOlder()` appends the
 * fixed rows and reports `exhausted: true`. Structurally compatible with each
 * domain `*HistoryReader` port.
 */
export interface MockHistoryReader<TEntry> {
  subscribe(onUpdate: (entries: ReadonlyArray<TEntry>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}

export interface SubscribeCandlesOptions {
  seed?: number
  tickIntervalMilliseconds?: number
}

export type CandleSubscriberStatus = 'active' | 'closed'

export type ConnectionFsmStatus = 'connected' | 'reconnecting'

export interface ConnectionFsmOptions {
  rng: () => number
  onChange: (status: ConnectionFsmStatus) => void
}

export interface ConnectionFsm {
  status: () => ConnectionFsmStatus
  simulateDisconnect: () => void
  simulateReconnect: () => void
  dispose: () => void
}

export interface BookSnapshot {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
}

export interface RestingLimit {
  identifier: OrderIdentifier
  symbol: string
  side: Side
  price: number
  size: number
  timestamp: number
}

export interface MarketFillInput {
  orderIdentifier: OrderIdentifier
  fillIdentifier: OrderIdentifier
  symbol: string
  side: Side
  size: number
  book: BookSnapshot
  midPrice: number
  timestamp: number
}

export interface CrossResult {
  filledOrders: RestingLimit[]
  fills: Fill[]
  remaining: RestingLimit[]
}

export interface AccountState {
  ordersByIdentifier: Map<OrderIdentifier, Order>
  restingLimitsBySymbol: Map<string, RestingLimit[]>
  fills: Fill[]
  positionsBySymbol: Map<string, Position>
}

export interface BookState {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  recentPriceDrift: number
  lastMidPrice: number
}

export interface MockVenueOptions {
  rng?: () => number
}

/**
 * Collaborators the order validation / preview seam needs from the venue
 * closure. The mock pulls its own "live" mark price and the account's available
 * margin from these injected readers, so `validateDraft` / `previewOrder` stay
 * pure functions of (draft, venue state) — testable in isolation without the
 * full venue. See ADR-0035 D-2 / D-4.
 */
export interface MockOrderValidationDeps {
  /** The venue's internal mark price for a symbol (0 when unknown). One source,
   *  shared between `validateDraft` (min-notional check) and `previewOrder`. */
  markPriceFor: (symbol: string) => number
  /** Available margin (USD collateral) the account can open against — drives the
   *  `OrderCapacity.maxCoinSize`. */
  availableMarginFor: (symbol: string) => number
}

export interface MockOrderValidation {
  validateDraft(draft: OrderDraft): Result<PlaceOrderRequest, OrderIssue[]>
  previewOrder(draft: OrderDraft): { estimates: OrderEstimates; capacity: OrderCapacity }
}

/**
 * Collaborators the order-placement seam needs from the venue closure. The
 * account state and book map are shared by reference with the rest of the
 * factory (resting-order crossing, cancel) — this is a testability seam, not a
 * decoupling boundary.
 */
export interface MockOrderPlacementDeps {
  accountState: AccountState
  bookStateMap: Map<string, BookState>
  nextIdentifier: (prefix: string) => string
  leverageFor: LeverageFor
  emitOrder: (order: Order) => void
  emitFill: (fill: Fill) => void
  emitPosition: (position: Position) => void
  broadcastTradeFromFill: (fill: Fill) => void
}

export interface MockOrderPlacement {
  fillMarketOrder(
    request: PlaceOrderRequest,
    orderIdentifier: OrderIdentifier,
    timestamp: number,
  ): PlaceOrderError | null
  placeLimitOrder(
    request: LimitOrderRequest,
    orderIdentifier: OrderIdentifier,
    timestamp: number,
  ): void
}
