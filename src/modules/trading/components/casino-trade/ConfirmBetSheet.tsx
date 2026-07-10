import { Sheet } from '@/modules/shared/components/Sheet'
import type { ConfirmCta } from '../../hooks/casino-trade.types'
import type { ConfirmBetSheetProps } from './casino-trade.types'
import styles from './casino-trade.module.css'

const CTA_LABEL: Record<ConfirmCta, string> = {
  connect: 'Create Account',
  'add-cash': 'Add Cash',
  'setting-up': 'Setting up your table…',
  placing: 'Placing bet…',
  'place-bet': 'Place Bet',
}

/** The confirm sheet (D16/D17). Always shows the liquidation sentence; the
 *  magenta PLACE BET submits a market IOC. The CTA swaps to Add Cash / Create
 *  Account per the gating, and to a loader while setup/placing runs (D6). */
export function ConfirmBetSheet({ pendingBet, onClose, onPrimary }: ConfirmBetSheetProps) {
  const isOpen = pendingBet !== null
  const cta = pendingBet?.cta ?? 'place-bet'
  const isBusy = cta === 'setting-up' || cta === 'placing'
  const directionWord = pendingBet?.direction === 'down' ? 'DOWN' : 'UP'

  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="bottom" ariaLabel="Confirm bet" title="Confirm Bet">
      {pendingBet ? (
        <div className={styles.confirm} data-testid="confirm-bet-sheet">
          <p className={styles.confirmHeadline}>
            <span className={styles.confirmAmount}>${pendingBet.betAmount}</span> on{' '}
            {pendingBet.ticker} going{' '}
            <span className={pendingBet.direction === 'up' ? styles.changeUp : styles.changeDown}>
              {directionWord}
            </span>
          </p>
          <p className={styles.confirmMultiplier}>{pendingBet.leverage}x multiplier</p>
          <p className={styles.confirmLiquidation} data-testid="confirm-liquidation">
            {pendingBet.liquidationSentence}
          </p>
          <button
            type="button"
            className={styles.placeBet}
            disabled={isBusy}
            aria-busy={isBusy}
            onClick={onPrimary}
            data-testid="confirm-primary"
          >
            {CTA_LABEL[cta]}
          </button>
        </div>
      ) : null}
    </Sheet>
  )
}
