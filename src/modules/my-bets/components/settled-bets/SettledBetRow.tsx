import styles from './settled-bets.module.css'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { directionLabel } from '../../my-bets.utils'
import type { SettledBetRowProps } from '../../my-bets.types'

/**
 * One SETTLED history row: the coin + the bet direction on the left, the signed
 * realised profit/loss (win/loss tone) on the right. Dumb.
 */
export function SettledBetRow({ bet }: SettledBetRowProps) {
  const toneClass = bet.isWin ? styles.win : styles.loss

  return (
    <li className={styles.row}>
      <span className={styles.ticker}>{bet.ticker}</span>
      <span className={styles.meta}>{directionLabel(bet.direction)}</span>
      <span className={`${styles.result} ${toneClass}`} data-testid="settled-bet-result">
        {formatUsd(bet.profitUsd, { signed: true })}
      </span>
    </li>
  )
}
