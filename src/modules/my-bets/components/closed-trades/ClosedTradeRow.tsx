import styles from './closed-trades.module.css'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { sideLabel } from '../../my-bets.utils'
import type { ClosedTradeRowProps } from '../../my-bets.types'

/**
 * One trade-history row: the coin + the side that was closed on the left, the
 * signed realised PnL (profit/loss tone) on the right. Dumb.
 */
export function ClosedTradeRow({ trade }: ClosedTradeRowProps) {
  const toneClass = trade.isUp ? styles.win : styles.loss

  return (
    <li className={styles.row}>
      <span className={styles.ticker}>{trade.ticker}</span>
      <span className={styles.meta}>{sideLabel(trade.side)}</span>
      <span className={`${styles.result} ${toneClass}`} data-testid="closed-trade-pnl">
        {formatUsd(trade.pnlUsd, { signed: true })}
      </span>
    </li>
  )
}
