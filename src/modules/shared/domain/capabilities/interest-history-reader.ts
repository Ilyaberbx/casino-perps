import type { ResultAsync } from 'neverthrow'
import type { Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

export interface InterestHistoryEntry {
  readonly asset: string
  readonly amountUsd: number
  readonly timestamp: number
}

/**
 * History port for the Portfolio "Interest History" tab. Backed by the
 * Hyperliquid `userBorrowLendInterest({ user, startTime, endTime })` info
 * endpoint — paged via 30-day windows walked backward (see PRD D2 for the
 * gap-skip rule and epoch-0 lower bound).
 */
export interface InterestHistoryReader {
  subscribe(
    onUpdate: (entries: ReadonlyArray<InterestHistoryEntry>) => void,
  ): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
