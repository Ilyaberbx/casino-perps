import { useCallback, useState } from 'react'
import type {
  UsePaginatedHistoryParams,
  UsePaginatedHistoryReturn,
} from './use-paginated-history.types'

/**
 * Bridges a backward-cursor history loader (`loadOlder` + `isExhausted`, as
 * exposed by TradeHistoryReader / OrderHistoryReader) to a fixed numbered-page
 * UI — the "client pages + auto-fetch tail" model from ADR-0023.
 *
 * Pages are sliced client-side over the rows loaded so far. Advancing past the
 * loaded tail while more history may exist fires `loadOlder()` and optimistically
 * moves the *desired* page forward; the *displayed* page is the desired page
 * clamped to what's loaded (`min(desired, pageCount)`), so it resolves on its
 * own once the fetched rows arrive — no effect, no setState-in-effect (the
 * React Compiler forbids the latter). `isExhausted` caps forward navigation so
 * the user cannot page past real data.
 */
export function usePaginatedHistory<T>({
  rows,
  pageSize,
  loadOlder,
  isExhausted,
}: UsePaginatedHistoryParams<T>): UsePaginatedHistoryReturn<T> {
  // `desiredPage` may sit one past the loaded tail while a fetch is in flight.
  const [desiredPage, setDesiredPage] = useState(1)

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  // Displayed page never exceeds what's loaded: an optimistic desiredPage
  // beyond the tail shows the last loaded page until the fetched rows land,
  // and a shrinking row list (address reset) clamps back automatically.
  const page = Math.min(desiredPage, pageCount)

  const start = (page - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  const hasLoadedNext = page < pageCount
  const canFetchMore = !isExhausted
  const canNext = hasLoadedNext || canFetchMore
  const canPrev = page > 1
  // A fetch is bridging the gap between the desired page and the loaded tail.
  const isFetchingMore = desiredPage > pageCount && canFetchMore

  const goPrev = useCallback(() => {
    setDesiredPage(Math.max(1, page - 1))
  }, [page])

  const goNext = useCallback(() => {
    if (hasLoadedNext) {
      setDesiredPage(page + 1)
      return
    }
    if (!canFetchMore) return
    // Past the loaded tail with more history available: move forward
    // optimistically and fetch. `page` clamps the display until rows arrive.
    setDesiredPage(page + 1)
    loadOlder()
  }, [hasLoadedNext, canFetchMore, page, loadOlder])

  const goToPage = useCallback(
    (target: number) => {
      setDesiredPage(Math.max(1, Math.min(target, pageCount)))
    },
    [pageCount],
  )

  return {
    pageRows,
    page,
    pageCount,
    canPrev,
    canNext,
    goPrev,
    goNext,
    goToPage,
    isFetchingMore,
  }
}
