import type { ResultAsync } from 'neverthrow'
import type { Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

export interface FundingHistoryEntry {
  readonly symbol: string
  readonly amountUsd: number
  readonly fundingRate: number
  readonly positionSize: number
  readonly timestamp: number
}

/**
 * History port for the Portfolio "Funding History" tab. Backed by the
 * Hyperliquid `userFunding({ user, startTime, endTime })` info endpoint —
 * paged via 30-day windows walked backward (see PRD D2 for the gap-skip rule
 * and epoch-0 lower bound).
 */
export interface FundingHistoryReader {
  subscribe(
    onUpdate: (entries: ReadonlyArray<FundingHistoryEntry>) => void,
  ): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
