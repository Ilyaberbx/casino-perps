import styles from './account-header.module.css'
import type { AccountHeaderProps } from '../../my-bets.types'

/**
 * Account-equity panel — the big display-face balance plus the two
 * money-movement actions. Both are hidden while disconnected: the connect entry
 * point lives in the app header (wallet-gate mode-3). Dumb: every value and
 * handler comes from the page hook.
 */
export function AccountHeader({
  equityLabel,
  isConnected,
  onDeposit,
  onWithdraw,
}: AccountHeaderProps) {
  return (
    <section className={styles.panel} aria-label="Account value">
      <span className={styles.label}>Account value</span>
      <span className={styles.amount} data-testid="account-equity">
        {equityLabel}
      </span>
      {isConnected ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onDeposit}>
            Deposit
          </button>
          <button type="button" className={styles.ghost} onClick={onWithdraw}>
            Withdraw
          </button>
        </div>
      ) : null}
    </section>
  )
}
