import type { Result } from 'neverthrow'

/** The persisted shape. Versioned from day one so a future migration has a
 *  discriminant to switch on (favorites had to back-fill one — see its `migrate`). */
export interface RecentMarketsPayload {
  version: 1
  symbols: string[]
}

export interface RecentMarketsStore {
  /** Load the persisted visit list, most-recent-first.
   *  Returns ok({ version: 1, symbols: [] }) when no entry exists **or** when the
   *  stored value is corrupt / a stale shape.
   *  Returns err('storage-read-failed') only if localStorage.getItem itself throws. */
  load(key: string): Result<RecentMarketsPayload, 'storage-read-failed'>
  /** Persist the visit list.
   *  Returns err('storage-write-failed') if localStorage.setItem throws (e.g. QuotaExceededError). */
  save(key: string, payload: RecentMarketsPayload): Result<void, 'storage-write-failed'>
}
