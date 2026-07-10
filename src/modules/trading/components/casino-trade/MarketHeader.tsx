import { formatUsd } from '@/modules/shared/utils/format-number'
import { formatChange } from './casino-trade.utils'
import type { MarketHeaderProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

/** ● BTC   $104,231.50   ▲ 2.4% — the market strip above the chart. */
export function MarketHeader({ ticker, markPrice, change24hPct }: MarketHeaderProps) {
  const hasChange = change24hPct !== null
  const isUp = hasChange && change24hPct >= 0
  const changeClass = isUp ? styles.changeUp : styles.changeDown
  return (
    <header className={styles.marketHeader} data-testid="casino-market-header">
      <div className={styles.marketIdentity}>
        <span className={styles.marketDot} aria-hidden="true" />
        <span className={styles.marketTicker}>{ticker}</span>
      </div>
      <span className={styles.marketPrice}>{formatUsd(markPrice)}</span>
      {hasChange ? (
        <span className={`${styles.marketChange} ${changeClass}`}>
          <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
          {formatChange(change24hPct)}
        </span>
      ) : null}
    </header>
  )
}
