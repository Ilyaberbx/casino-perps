import styles from './cash-header.module.css'
import type { CashHeaderProps } from '../../my-bets.types'

/**
 * YOUR CASH panel — the big display-face balance plus the two money-movement
 * actions. ADD CASH is the teal primary (D7: "Add Cash" = Deposit); WITHDRAW is
 * the ghost secondary ("Cash Out to Wallet"). Both are hidden while
 * disconnected — the connect entry point lives in the app header (wallet-gate
 * mode-3). Dumb: every value and handler comes from the page hook.
 */
export function CashHeader({ cashLabel, isConnected, onAddCash, onWithdraw }: CashHeaderProps) {
  return (
    <section className={styles.panel} aria-label="Your cash">
      <span className={styles.label}>Your cash</span>
      <span className={styles.amount} data-testid="cash-amount">
        {cashLabel}
      </span>
      {isConnected ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onAddCash}>
            Add Cash
          </button>
          <button type="button" className={styles.ghost} onClick={onWithdraw}>
            Cash Out to Wallet
          </button>
        </div>
      ) : null}
    </section>
  )
}
