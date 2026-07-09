import styles from './portfolio-chart.module.css'
import type { PortfolioChartErrorProps } from './portfolio-chart.types'
import { CHART_ERROR_MESSAGE } from './portfolio-chart.constants'
import { PixelButton } from '../../../shared/components/pixel-button'

export function PortfolioChartError({ error, onRetry }: PortfolioChartErrorProps) {
  const message = CHART_ERROR_MESSAGE[error.kind]

  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.errorTile}>
        <span className={styles.errorTitle}>Chart unavailable</span>
        <span className={styles.errorMessage}>{message}</span>
        <PixelButton size="sm" variant="directionDown" onClick={onRetry}>
          Reload
        </PixelButton>
      </div>
    </div>
  )
}
