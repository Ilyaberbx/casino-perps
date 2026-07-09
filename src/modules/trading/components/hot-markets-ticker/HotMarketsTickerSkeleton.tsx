import styles from './hot-markets-ticker.module.css'
import { SKELETON_PILL_COUNT } from './hot-markets-ticker.constants'

/**
 * Loading state for the hot-markets ticker: a row of shimmer pills shown while
 * the venue market universe is still loading (listMarkets() empty). Matches the
 * accent-soft + pixel-border skeleton aesthetic used elsewhere in the app.
 */
export function HotMarketsTickerSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading hot markets">
      {Array.from({ length: SKELETON_PILL_COUNT }).map((_, index) => (
        <span key={index} className={styles.skeletonPill} aria-hidden="true" />
      ))}
    </div>
  )
}
