import type { CSSProperties } from 'react'
import styles from './portfolio-chart.module.css'
import { SKELETON_HEIGHTS } from './portfolio-chart.constants'

export function PortfolioChartSkeleton() {
  return (
    <div className={styles.overlay} role="status" aria-label="Loading chart">
      <div className={styles.skeleton}>
        {SKELETON_HEIGHTS.map((heightPercent, index) => (
          <div
            key={index}
            className={styles.skeletonBar}
            style={{ '--bar-height': `${heightPercent}%` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}
