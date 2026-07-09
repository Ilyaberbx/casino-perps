import styles from './chart.module.css'

/**
 * Neutral, informational no-candle graceful state (D-01 / UI-SPEC §1).
 * A fork of `ChartErrorTile` — same `.overlay` geometry — but deliberately
 * NOT the alarm variant: `role="status"` (not `role="alert"`), `--textMuted`
 * on `--surface` with a `--border-strong` border (never `--directionDown` /
 * `--warning`), and NO Retry affordance (`hasCandles=false` is a stable
 * property of the market — there is nothing to retry).
 */
export function ChartUnavailableTile() {
  return (
    <div className={styles.overlay} role="status">
      <div className={styles.unavailableTile}>
        <span className={styles.unavailableHeading}>CHART DATA NOT AVAILABLE</span>
        <span className={styles.unavailableSubline}>
          This market does not provide candle history.
        </span>
      </div>
    </div>
  )
}
