import type { ResultAsync } from 'neverthrow'
import type { Side, Unsubscribe } from '../domain.types'
import type { PortfolioHistoryFetchError } from '../portfolio'

export type TwapHistoryStatus = 'finished' | 'terminated' | 'error' | 'activated'

export interface TwapHistoryEntry {
  readonly identifier: string
  readonly symbol: string
  readonly side: Side
  readonly size: number
  readonly executedSize: number
  readonly executedNotionalUsd: number
  readonly status: TwapHistoryStatus
  readonly createdAt: number
  readonly endedAt: number | null
  /** TWAP run window in minutes (the History tab's "TWAP Duration" column).
   *  Additive optional field (ADR-0013) — absent ⇒ render `--`. */
  readonly durationMinutes?: number
  /** Whether the TWAP was reduce-only ("Reduce Only" column). Absent ⇒ `--`. */
  readonly reduceOnly?: boolean
  /** Whether the TWAP randomized slice timing ("Randomize" column). Absent ⇒ `--`. */
  readonly randomize?: boolean
}

/**
 * History port for completed TWAP orders. The Hyperliquid `twapHistory` info
 * endpoint accepts only `{ user }` and returns the venue's full retained list
 * — see PRD D2: this is a one-shot reader. The first `loadOlder()` call
 * performs the only fetch; subsequent calls return `ok({ exhausted: true })`.
 */
export interface TwapHistoryReader {
  subscribe(
    onUpdate: (entries: ReadonlyArray<TwapHistoryEntry>) => void,
  ): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}
