import { InfoTooltip } from '@/modules/shared/components/info-tooltip'
import { ValueSkeleton } from '@/modules/shared/components/value-skeleton'
import { formatUsd } from '@/modules/shared/utils/format-number'
import type { EquityCardRowProps, EquityRowValueProps } from './trade-equity-card.types'
import { EQUITY_PLACEHOLDER } from './trade-equity-card.constants'
import { formatLeverage } from './trade-equity-card.utils'
import styles from './trade-equity-card.module.css'

/**
 * One label/value row in the equity breakdown. `muted` renders the indented,
 * dimmed sub-group (uPnL / Maintenance Margin / Account Leverage); `tone` colors
 * a signed value (uPnL); `tooltip` turns the label into a dotted-underline
 * InfoTooltip trigger. Dumb leaf.
 */
export function EquityCardRow({
  label,
  value,
  isLoading,
  muted = false,
  format = 'usd',
  tone = 'neutral',
  tooltip,
}: EquityCardRowProps) {
  const rowClass = muted ? `${styles.row} ${styles.rowMuted}` : styles.row
  const toneClass = tone === 'up' ? styles.toneUp : tone === 'down' ? styles.toneDown : ''
  return (
    <div className={rowClass}>
      <span className={styles.rowLabel}>
        {tooltip !== undefined ? <InfoTooltip label={label} content={tooltip} /> : label}
      </span>
      <span className={`${styles.rowValue} ${toneClass}`}>
        <EquityRowValue value={value} isLoading={isLoading} format={format} />
      </span>
    </div>
  )
}

function EquityRowValue({ value, isLoading, format = 'usd' }: EquityRowValueProps) {
  if (isLoading && value === null) return <ValueSkeleton ariaLabel="Loading value" width={64} />
  if (value === null) return <>{EQUITY_PLACEHOLDER}</>
  if (format === 'leverage') return <>{formatLeverage(value)}</>
  if (format === 'signedUsd') return <>{formatUsd(value, { signed: true })}</>
  return <>{formatUsd(value)}</>
}
