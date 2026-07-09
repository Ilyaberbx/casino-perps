import styles from './rows-skeleton.module.css'
import type { RowsSkeletonProps } from './rows-skeleton.types'

/**
 * Venue-agnostic loading placeholder for the order book and trades tape: a fixed
 * column of shimmer rows shown until a panel's first complete snapshot lands, so
 * it flips once from skeleton to populated rather than filling in partially.
 * See ADR-0030.
 */
export function RowsSkeleton({ rows, className }: RowsSkeletonProps) {
  const containerClass = className === undefined ? styles.container : `${styles.container} ${className}`
  return (
    <div className={containerClass} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_unused, index) => (
        <div key={index} className={styles.row} data-testid="skeleton-row" aria-hidden="true" />
      ))}
    </div>
  )
}
