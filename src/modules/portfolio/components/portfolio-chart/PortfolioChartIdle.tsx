import styles from './portfolio-chart.module.css'

export function PortfolioChartIdle() {
  return (
    <div className={styles.overlay} role="status" aria-label="No activity in selected window">
      <div className={styles.idleTile}>
        <div className={styles.idleSprite} aria-hidden="true">
          <span>Z</span>
          <span>Z</span>
          <span>Z</span>
        </div>
        <div className={styles.idleLabel}>No activity</div>
      </div>
    </div>
  )
}
