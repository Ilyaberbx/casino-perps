import type { TickerStatsProps, MarketStripStats } from './top-bar.types'
import styles from './top-bar.module.css'

function OracleCell({ oraclePriceText }: { oraclePriceText: string }) {
  return (
    <div className={styles.statItem}>
      <span className={styles.statLabel}>Oracle</span>
      <span className={styles.statValue}>{oraclePriceText}</span>
    </div>
  )
}

function PerpCells({ stats }: { stats: Extract<MarketStripStats, { marketType: 'perp' }> }) {
  const fundingClassName =
    stats.fundingRateDirection === 'up' ? styles.statValueUp : styles.statValueDown
  return (
    <>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Open Interest</span>
        <span className={styles.statValue}>{stats.openInterestText}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Funding / Countdown</span>
        <span className={styles.statValue}>
          <span className={fundingClassName}>{stats.fundingRateText}</span>
          {' '}
          {stats.fundingCountdownText}
        </span>
      </div>
    </>
  )
}

export function TickerStats({ stats, markFlash }: TickerStatsProps) {
  if (stats === null) {
    return <div className={styles.tickerStats} aria-label="Ticker loading" />
  }

  const changeClassName =
    stats.change24hDirection === 'up' ? styles.statValueUp : styles.statValueDown
  const hasOracle = stats.marketType !== 'spot'

  return (
    <div className={styles.tickerStats}>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Mark</span>
        {/* Keyed on the formatted price so a value change remounts this single
            span and replays the directional tick flash (ADR-0043). */}
        <span key={stats.markPriceText} className={styles.statValuePrice} data-flash={markFlash ?? undefined}>
          {stats.markPriceText}
        </span>
      </div>
      {hasOracle ? <OracleCell oraclePriceText={stats.oraclePriceText} /> : null}
      <div className={styles.statItem}>
        <span className={styles.statLabel}>24h Change</span>
        <span className={changeClassName}>{stats.change24hText}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>24h Volume</span>
        <span className={styles.statValue}>{stats.volume24hText}</span>
      </div>
      {stats.marketType === 'perp' ? <PerpCells stats={stats} /> : null}
    </div>
  )
}
