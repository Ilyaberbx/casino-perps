import type { ResultAsync } from 'neverthrow'
import type { Fill, Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

/**
 * History port for the Portfolio "Trade History" tab. Backed by the
 * Hyperliquid `userFillsByTime({ user, startTime, endTime })` info endpoint —
 * paged via 30-day windows walked backward (see PRD D2 for the gap-skip rule
 * and epoch-0 lower bound). The reader holds the merged accumulated list
 * internally; `subscribe` only attaches a listener and emits the current
 * list. Every fetch — including the initial one on mount — flows through
 * `loadOlder()`.
 */
export interface TradeHistoryReader {
  subscribe(onUpdate: (fills: ReadonlyArray<Fill>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
