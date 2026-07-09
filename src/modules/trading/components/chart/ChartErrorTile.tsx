import styles from './chart.module.css'
import type { ChartErrorTileProps } from './chart.types'
import { PixelButton } from '@/modules/shared/components/pixel-button'

export function ChartErrorTile({ onRetry }: ChartErrorTileProps) {
  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.errorTile}>
        <span className={styles.errorMessage}>CHART UNAVAILABLE</span>
        <PixelButton variant="default" size="sm" onClick={onRetry}>
          Retry
        </PixelButton>
      </div>
    </div>
  )
}
