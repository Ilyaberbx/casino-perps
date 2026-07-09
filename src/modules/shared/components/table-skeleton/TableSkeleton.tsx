import type { CSSProperties } from 'react'
import styles from './table-skeleton.module.css'
import type { TableSkeletonProps } from './table-skeleton.types'

const DEFAULT_ROWS = 6

/**
 * Column-aware loading placeholder for the account-dock tables. Renders a fixed
 * column of shimmer rows on the panel's own grid template, so the flip from
 * skeleton to populated has zero layout shift (the cells sit where the real
 * cells will land). Shares the `accent-soft` pulse + reduced-motion contract
 * with `RowsSkeleton`; see ADR-0036.
 */
export function TableSkeleton({
  gridTemplate,
  columns,
  rows = DEFAULT_ROWS,
  ariaLabel = 'Loading',
}: TableSkeletonProps) {
  const rowStyle = { gridTemplateColumns: gridTemplate } as CSSProperties
  return (
    <div className={styles.container} role="status" aria-label={ariaLabel}>
      {Array.from({ length: rows }, (_unusedRow, rowIndex) => (
        <div key={rowIndex} className={styles.row} style={rowStyle} aria-hidden="true">
          {Array.from({ length: columns }, (_unusedCell, cellIndex) => (
            <span key={cellIndex} className={styles.cell} data-testid="table-skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  )
}
