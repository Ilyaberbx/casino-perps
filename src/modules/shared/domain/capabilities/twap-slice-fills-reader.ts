import type { ResultAsync } from 'neverthrow'
import type { Fill, Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

/**
 * History port for the TWAP panel's "Fill History" sub-tab (ADR-0053). Backed
 * by the Hyperliquid `userTwapSliceFillsByTime({ user, startTime, endTime })`
 * info endpoint — the per-slice executions of the user's TWAP orders, paged via
 * `endTime`-cursor windows walked backward (same seam as `TradeHistoryReader`).
 * Each slice fill is projected to the shared `Fill` shape so the Fill History
 * panel reuses the trade-history columns (Time, Asset, Side, Price, Size, Trade
 * Value, Fee, Closed PNL). The reader holds the merged accumulated list
 * internally; `subscribe` attaches a listener and emits the current list. Every
 * fetch — including the initial one on mount — flows through `loadOlder()`.
 */
export interface TwapSliceFillsReader {
  subscribe(onUpdate: (fills: ReadonlyArray<Fill>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
