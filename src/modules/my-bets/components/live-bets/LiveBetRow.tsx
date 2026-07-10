import styles from './live-bets.module.css'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { directionLabel } from '../../my-bets.utils'
import type { LiveBetRowProps } from '../../my-bets.types'

/**
 * One LIVE BETS row: a win/loss dot, the coin + direction + multiplier, the
 * signed profit/loss, the always-shown liquidation prose (D16), and a Cash Out
 * that market-closes the full bet. Dumb — the parent owns the handler.
 */
export function LiveBetRow({ bet, onCashOut }: LiveBetRowProps) {
  const toneClass = bet.isWinning ? styles.win : styles.loss

  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <span className={`${styles.dot} ${toneClass}`} aria-hidden="true" />
        <span className={styles.ticker}>{bet.ticker}</span>
        <span className={styles.meta}>
          {directionLabel(bet.direction)} {bet.leverage}x
        </span>
        <span className={`${styles.profit} ${toneClass}`} data-testid="live-bet-profit">
          {formatUsd(bet.profitUsd, { signed: true })}
        </span>
      </div>
      <p className={styles.liquidation}>{bet.liquidationSentence}</p>
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.cashOut}
          onClick={() => onCashOut(bet.symbol)}
          disabled={bet.isCashingOut}
        >
          {bet.isCashingOut ? 'Cashing Out…' : 'Cash Out'}
        </button>
      </div>
    </li>
  )
}
