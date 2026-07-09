export interface TableSkeletonProps {
  /**
   * The CSS `grid-template-columns` value for a row — pass the panel's own grid
   * token (`'var(--positions-grid)'`) so skeleton cells land in the real columns,
   * or an explicit template for non-tokenised tables.
   */
  gridTemplate: string
  /** Number of shimmer cells per row — match the table's column count. */
  columns: number
  /** Number of placeholder rows. */
  rows?: number
  ariaLabel?: string
}
