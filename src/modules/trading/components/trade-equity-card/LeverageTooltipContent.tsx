import { formatUsd } from '@/modules/shared/utils/format-number'
import type { LeverageTooltipContentProps } from './trade-equity-card.types'
import { EQUITY_PLACEHOLDER } from './trade-equity-card.constants'
import { formatLeverage } from './trade-equity-card.utils'
import styles from './trade-equity-card.module.css'

/**
 * The Account Leverage tooltip: the `(a)/(b)` breakdown with live values,
 * mirroring the reference popover. `—` for any value the venue can't supply
 * (unified / disconnected). Dumb leaf.
 */
export function LeverageTooltipContent({ breakdown }: LeverageTooltipContentProps) {
  const aDisplay = breakdown.aValue === null ? EQUITY_PLACEHOLDER : formatUsd(breakdown.aValue)
  const bDisplay = breakdown.bValue === null ? EQUITY_PLACEHOLDER : formatUsd(breakdown.bValue)
  const resultDisplay =
    breakdown.resultValue === null ? EQUITY_PLACEHOLDER : formatLeverage(breakdown.resultValue)

  return (
    <div className={styles.leverageTooltip}>
      <div className={styles.leverageTooltipRow}>
        <span>{breakdown.aLabel} (a)</span>
        <span className={styles.leverageTooltipValue}>{aDisplay}</span>
      </div>
      <div className={styles.leverageTooltipRow}>
        <span>{breakdown.bLabel} (b)</span>
        <span className={styles.leverageTooltipValue}>{bDisplay}</span>
      </div>
      <div className={`${styles.leverageTooltipRow} ${styles.leverageTooltipResult}`}>
        <span>{breakdown.resultLabel} = (a) / (b)</span>
        <span className={styles.leverageTooltipValue}>{resultDisplay}</span>
      </div>
    </div>
  )
}
