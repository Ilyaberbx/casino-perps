import type { ResultAsync } from 'neverthrow'
import type { Side, Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

/**
 * Order processing status as exposed by the Hyperliquid `historicalOrders`
 * endpoint. Mirrors the SDK's `OrderProcessingStatusSchema` literal-by-literal
 * — the SDK type re-export is the source of truth, and a static type
 * equivalence check inside the reader (`hyperliquid/services/order-history-reader.ts`)
 * fails typecheck if the two diverge.
 *
 * The 28 literals map to broader UI categories (open / filled / cancelled / rejected /
 * triggered) at render time via the Portfolio status renderer; future SDK
 * additions surface as a typecheck failure rather than a silent "unknown".
 */
export type HistoricalOrderStatus =
  | 'open'
  | 'filled'
  | 'canceled'
  | 'triggered'
  | 'rejected'
  | 'marginCanceled'
  | 'vaultWithdrawalCanceled'
  | 'openInterestCapCanceled'
  | 'selfTradeCanceled'
  | 'reduceOnlyCanceled'
  | 'siblingFilledCanceled'
  | 'delistedCanceled'
  | 'liquidatedCanceled'
  | 'scheduledCancel'
  | 'tickRejected'
  | 'minTradeNtlRejected'
  | 'perpMarginRejected'
  | 'reduceOnlyRejected'
  | 'badAloPxRejected'
  | 'iocCancelRejected'
  | 'badTriggerPxRejected'
  | 'marketOrderNoLiquidityRejected'
  | 'positionIncreaseAtOpenInterestCapRejected'
  | 'positionFlipAtOpenInterestCapRejected'
  | 'tooAggressiveAtOpenInterestCapRejected'
  | 'openInterestIncreaseRejected'
  | 'insufficientSpotBalanceRejected'
  | 'oracleRejected'
  | 'perpMaxPositionRejected'

export type HistoricalOrderType =
  | 'Market'
  | 'Limit'
  | 'Stop Market'
  | 'Stop Limit'
  | 'Take Profit Market'
  | 'Take Profit Limit'

export type HistoricalOrderTif =
  | 'Gtc'
  | 'Ioc'
  | 'Alo'
  | 'FrontendMarket'
  | 'LiquidationMarket'
  | null

export interface HistoricalOrder {
  readonly identifier: string
  readonly symbol: string
  readonly side: Side
  readonly price: number
  readonly size: number
  readonly originalSize: number
  readonly orderType: HistoricalOrderType
  readonly timeInForce: HistoricalOrderTif
  readonly reduceOnly: boolean
  readonly isTrigger: boolean
  readonly triggerPrice: number
  readonly status: HistoricalOrderStatus
  readonly createdAt: number
  readonly statusTimestamp: number
}

/**
 * History port for the Portfolio "Order History" tab. Backed by the
 * Hyperliquid `historicalOrders({ user })` info endpoint, which accepts no
 * time bounds — see PRD D2: this is a one-shot reader. The first
 * `loadOlder()` call fetches the venue's retained list; subsequent calls
 * return `ok({ exhausted: true })`.
 */
export interface OrderHistoryReader {
  subscribe(orders: (orders: ReadonlyArray<HistoricalOrder>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
