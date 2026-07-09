import { formatUsd, formatTokenAmount } from '@/modules/shared/utils/format-number'
import styles from './order-entry.module.css'
import type { OrderInfoRowsProps } from './order-entry.types'

/** Available-to-trade collateral + current open position, shown above the size
 *  field (mirrors trade.xyz's order-entry info rows). */
export function OrderInfoRows({
  availableToTrade,
  availableUnit,
  currentPositionSize,
  baseAsset,
}: OrderInfoRowsProps) {
  // Spot sell reports base-token holdings (coin); everything else is USD.
  const availableDisplay =
    availableUnit === 'coin'
      ? `${formatTokenAmount(availableToTrade)} ${baseAsset}`
      : formatUsd(availableToTrade)
  return (
    <dl className={styles.infoRows} aria-label="Account context">
      <div className={styles.infoRow}>
        <dt className={styles.summaryLabel}>Available to Trade</dt>
        <dd className={styles.summaryValue}>{availableDisplay}</dd>
      </div>
      <div className={styles.infoRow}>
        <dt className={styles.summaryLabel}>Current Position</dt>
        <dd className={styles.summaryValue}>
          {formatTokenAmount(currentPositionSize)} {baseAsset}
        </dd>
      </div>
    </dl>
  )
}
