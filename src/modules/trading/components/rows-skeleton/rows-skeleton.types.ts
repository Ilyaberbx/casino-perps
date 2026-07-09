export interface RowsSkeletonProps {
  /** Number of shimmer rows to render — size it to the panel's resting row count to avoid layout shift. */
  rows: number
  /** Forwarded to the container so a panel can make the skeleton fill its body. */
  className?: string
}
