export interface PaginationProps {
  /** Current page, 1-based. */
  page: number
  /** Total pages currently addressable (≥ 1). */
  pageCount: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  /** Jump to a specific page (1-based). */
  onSelect: (page: number) => void
  /** A "next page" fetch past the loaded tail is in flight. */
  isFetchingMore?: boolean
  /** Max numbered page buttons to render before windowing. Default 5. */
  maxButtons?: number
  ariaLabel?: string
  className?: string
}
