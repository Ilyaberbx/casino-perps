import styles from './chart.module.css'
import { TIMEFRAMES, TIMEFRAME_LABELS, TIMEFRAME_GROUPS } from './chart.constants'
import { formatVolume } from './chart.utils'
import type { ChartHeaderProps } from './chart.types'
import { IconSelect } from '@/modules/shared/components/icon-select'
import { numberFormat } from '@/modules/shared/utils/intl-cache'
import type { Interval } from '../../../shared/domain/domain.types'

const TIMEFRAME_OPTIONS = TIMEFRAMES.map((tf) => ({
  value: tf,
  label: TIMEFRAME_LABELS[tf],
  group: TIMEFRAME_GROUPS[tf],
}))

export function ChartHeader({ ohlc, interval, onIntervalChange, priceDecimals }: ChartHeaderProps) {
  const isUp = ohlc !== null && ohlc.close >= ohlc.open
  const closeClassName =
    ohlc === null
      ? styles.ohlcvValue
      : `${styles.ohlcvValue} ${isUp ? styles.ohlcvUp : styles.ohlcvDown}`

  // Fixed decimals (not magnitude-stripped) so O/H/L/C line up with the axis.
  const fmt = (value: number) =>
    numberFormat({
      minimumFractionDigits: priceDecimals,
      maximumFractionDigits: priceDecimals,
    }).format(value)

  return (
    <header className={styles.header}>
      <div className={styles.ohlcv} aria-label="OHLCV">
        <span>
          <span className={styles.ohlcvLabel}>O</span>
          <span className={styles.ohlcvValue}>{ohlc === null ? '—' : fmt(ohlc.open)}</span>
        </span>
        <span>
          <span className={styles.ohlcvLabel}>H</span>
          <span className={styles.ohlcvValue}>{ohlc === null ? '—' : fmt(ohlc.high)}</span>
        </span>
        <span>
          <span className={styles.ohlcvLabel}>L</span>
          <span className={styles.ohlcvValue}>{ohlc === null ? '—' : fmt(ohlc.low)}</span>
        </span>
        <span>
          <span className={styles.ohlcvLabel}>C</span>
          <span className={closeClassName}>{ohlc === null ? '—' : fmt(ohlc.close)}</span>
        </span>
        <span>
          <span className={styles.ohlcvLabel}>V</span>
          <span className={styles.ohlcvValue}>{ohlc === null ? '—' : formatVolume(ohlc.volume)}</span>
        </span>
      </div>
      <IconSelect
        options={TIMEFRAME_OPTIONS}
        value={interval}
        // Every option value comes from TIMEFRAMES, so the string is always an
        // Interval; IconSelect's surface is intentionally string-typed.
        onChange={(value) => onIntervalChange(value as Interval)}
        ariaLabel="Timeframe"
        className={styles.timeframeSelect}
      />
    </header>
  )
}
