import styles from './market-card.module.css'

/**
 * Loading placeholder for a poster card. Same 3:4 footprint and 8px radius as
 * `MarketCard`, with a shimmer that quiets under `prefers-reduced-motion`.
 */
export function MarketCardSkeleton() {
  return (
    <div className={styles.skeleton} role="presentation" aria-hidden="true">
      <div className={styles.skeletonLogo} />
      <div className={styles.skeletonFooter}>
        <div className={styles.skeletonTicker} />
        <div className={styles.skeletonChip} />
      </div>
    </div>
  )
}
