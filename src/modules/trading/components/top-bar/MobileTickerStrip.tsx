import type { TickerStatsProps, MarketStripStats } from './top-bar.types'
import styles from './top-bar.module.css'

function SecondaryStat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <span className={styles.mobileStat}>
      <span className={styles.mobileStatLabel}>{label}</span>
      <span className={valueClassName ?? styles.mobileStatValue}>{value}</span>
    </span>
  )
}

function PerpSecondaryStats({ stats }: { stats: Extract<MarketStripStats, { marketType: 'perp' }> }) {
  const fundingClassName =
    stats.fundingRateDirection === 'up' ? styles.mobileStatValueUp : styles.mobileStatValueDown
  return (
    <>
      <SecondaryStat label="OI" value={stats.openInterestText} />
      <SecondaryStat
        label="Funding"
        value={`${stats.fundingRateText} ${stats.fundingCountdownText}`}
        valueClassName={fundingClassName}
      />
    </>
  )
}

export function MobileTickerStrip({ stats, markFlash }: TickerStatsProps) {
  if (stats === null) {
    return <div className={styles.mobileTicker} aria-label="Ticker loading" />
  }

  const changeClassName =
    stats.change24hDirection === 'up' ? styles.mobileChangeUp : styles.mobileChangeDown
  const hasOracle = stats.marketType !== 'spot'

  return (
    <div className={styles.mobileTicker}>
      <div className={styles.mobilePriceRow}>
        {/* Keyed on the formatted price so a value change remounts this span and
            replays the directional tick flash (ADR-0043). */}
        <span
          key={stats.markPriceText}
          className={styles.mobilePrice}
          data-flash={markFlash ?? undefined}
        >
          {stats.markPriceText}
        </span>
        <span className={changeClassName}>{stats.change24hText}</span>
      </div>
      <div className={styles.mobileStatStrip}>
        {hasOracle ? <SecondaryStat label="Oracle" value={stats.oraclePriceText} /> : null}
        <SecondaryStat label="24h Vol" value={stats.volume24hText} />
        {stats.marketType === 'perp' ? <PerpSecondaryStats stats={stats} /> : null}
      </div>
    </div>
  )
}
