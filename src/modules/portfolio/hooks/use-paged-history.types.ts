import type { ResultAsync } from 'neverthrow'
import type { Unsubscribe, PortfolioHistoryFetchError } from '@/modules/shared/domain'

/**
 * Structural shape of a paged/one-shot history capability reader: subscribe to
 * the accumulated list, fetch the next older page via `loadOlder`. Every domain
 * `*HistoryReader` port (trade/funding/order/interest/account-activity) and the
 * mock venue's `createMockHistoryReader` satisfy it by shape.
 */
export interface PagedHistoryReader<T> {
  subscribe(onUpdate: (entries: ReadonlyArray<T>) => void): Unsubscribe
  loadOlder(): ResultAsync<{ exhausted: boolean }, PortfolioHistoryFetchError>
}

export interface UsePagedHistoryReturn<T> {
  entries: ReadonlyArray<T>
  exhausted: boolean
  error: PortfolioHistoryFetchError | null
  /** True while a fetch is in flight (initial load starts true). */
  loadingMore: boolean
  loadOlder: () => void
}
