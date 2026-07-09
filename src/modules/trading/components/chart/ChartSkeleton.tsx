import type { CSSProperties } from 'react'
import styles from './chart.module.css'

const SKELETON_HEIGHTS = [
  20, 40, 30, 55, 35, 70, 50, 25, 60, 45, 80, 35, 55, 40, 65, 30, 75, 50, 45, 60, 35, 70, 25, 55,
] as const

export function ChartSkeleton() {
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
