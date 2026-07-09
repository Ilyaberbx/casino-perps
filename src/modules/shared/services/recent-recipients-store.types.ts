import type { Result } from 'neverthrow'
import type { Logger } from '../logger'

/**
 * Storage port for the recent-recipients list — a narrow `getItem`/`setItem`
 * slice of the `Storage` interface. Injectable so the store is unit-testable
 * without a real `localStorage`. Defaults to `localStorage` in the factory.
 */
export interface RecentRecipientsStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The only failure mode: the underlying storage read/write threw. */
export type RecentRecipientsStoreError = { kind: 'storage'; cause: unknown }

/**
 * Per-(Privy DID) list of addresses the user has recently sent to. Newest-first,
 * deduped (case-insensitive), and capped at `limit`. Persisted to localStorage
 * so the send form can offer them as recipient suggestions across sessions.
 */
export interface RecentRecipientsStore {
  /** Newest-first list of recent recipient addresses for this user. */
  load(privyId: string): Result<ReadonlyArray<string>, RecentRecipientsStoreError>
  /**
   * Prepend `address` (deduped case-insensitively, capped at `limit`); returns
   * the new newest-first list. A malformed address is ignored (the current list
   * is returned unchanged) rather than persisted.
   */
  record(
    privyId: string,
    address: string,
  ): Result<ReadonlyArray<string>, RecentRecipientsStoreError>
}

export interface CreateRecentRecipientsStoreOptions {
  readonly storage?: RecentRecipientsStorage
  readonly logger: Logger
  /** Max entries retained per user. Defaults to `DEFAULT_RECENT_RECIPIENTS_LIMIT`. */
  readonly limit?: number
}
