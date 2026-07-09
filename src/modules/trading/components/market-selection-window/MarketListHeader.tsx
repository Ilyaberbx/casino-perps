import styles from './market-selection-window.module.css'

/**
 * Dumb column-header row for the market list (issue 8 / ADR-0016).
 * Zero hooks, zero props. Shares the `--market-grid` track template with
 * `.row` so every label sits directly above its column. Pinned above the
 * scroll area (flex-shrink:0) so it stays visible while the list scrolls.
 *
 * Columns mirror MarketRow: icon · SYMBOL · TAG · PRICE · 24H% · VOLUME · star.
 */
export function MarketListHeader() {
  return (
    <div className={styles.headerRow} role="row" aria-hidden="true">
      <span className={styles.headerCell} />
      <span className={styles.headerCell}>SYMBOL</span>
      <span className={styles.headerCell}>TAG</span>
      <span className={`${styles.headerCell} ${styles.headerNumeric}`}>PRICE</span>
      <span className={`${styles.headerCell} ${styles.headerNumeric}`}>24H%</span>
      <span className={`${styles.headerCell} ${styles.headerNumeric}`}>VOLUME</span>
      <span className={styles.headerCell} />
    </div>
  )
}
