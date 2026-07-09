export interface UsePaginatedHistoryParams<T> {
  /** Full list of rows loaded so far (ascending or descending — untouched). */
  readonly rows: ReadonlyArray<T>
  /** Rows per page. */
  readonly pageSize: number
  /** Fetch the next backward window. Called when paging past the loaded tail
   *  while more history may exist. */
  readonly loadOlder: () => void
  /** No more history exists behind the loaded rows — caps forward paging. */
  readonly isExhausted: boolean
  /** A fetch is currently in flight. */
  readonly isLoading: boolean
}

export interface UsePaginatedHistoryReturn<T> {
  /** Rows for the current page. */
  readonly pageRows: ReadonlyArray<T>
  /** Current page, 1-based. */
  readonly page: number
  /** Number of pages over the rows loaded so far (≥ 1). */
  readonly pageCount: number
  readonly canPrev: boolean
  readonly canNext: boolean
  readonly goPrev: () => void
  readonly goNext: () => void
  /** Navigate to a loaded page (1-based, clamped). */
  readonly goToPage: (page: number) => void
  /** A "next page" fetch past the loaded tail is in flight. */
  readonly isFetchingMore: boolean
}
