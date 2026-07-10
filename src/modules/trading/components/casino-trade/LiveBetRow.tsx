import { PixelButton } from '@/modules/shared/components/pixel-button'
import { formatUsd } from '@/modules/shared/utils/format-number'
import type { LiveBetRowProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

/** The single open-bet row: direction · multiplier · profit · liquidation prose
 *  · CASH OUT (market-closes the full position). */
export function LiveBetRow({ liveBet, isCashingOut, onCashOut }: LiveBetRowProps) {
  const directionWord = liveBet.direction === 'up' ? 'UP' : 'DOWN'
  const directionClass = liveBet.direction === 'up' ? styles.changeUp : styles.changeDown
  const profitClass = liveBet.isWinning ? styles.changeUp : styles.changeDown
  return (
    <div className={styles.liveBet} data-testid="live-bet-row">
      <div className={styles.liveBetMain}>
        <span className={`${styles.liveBetDirection} ${directionClass}`}>{directionWord}</span>
        <span className={styles.liveBetMultiplier}>{liveBet.leverage}x</span>
        <span className={`${styles.liveBetProfit} ${profitClass}`} data-testid="live-bet-profit">
          {formatUsd(liveBet.profitUsd, { signed: true })}
        </span>
      </div>
      <p className={styles.liveBetLiquidation}>{liveBet.liquidationSentence}</p>
      <PixelButton
        variant="accent"
        fullWidth
        disabled={isCashingOut}
        aria-busy={isCashingOut}
        onClick={onCashOut}
        data-testid="cash-out"
      >
        {isCashingOut ? 'Cashing out…' : 'Cash Out'}
      </PixelButton>
    </div>
  )
}
