import { Search } from 'lucide-react'
import { AccountAvatarTrigger } from '@/modules/account'
import styles from './center-top-bar.module.css'
import type { CenterTopBarProps } from './center-top-bar.types'

/**
 * The center column's top bar (desktop). A search magnifier that opens the
 * market-search overlay (PRD 0008 D15) plus the auth controls: the account
 * avatar when signed in, or Log In / Create Account when not. "Create Account"
 * is the magenta commit button (PRD §5.1). Dumb — handlers come from the shell.
 */
export function CenterTopBar({
  authenticated,
  onOpenSearch,
  onLogIn,
  onCreateAccount,
}: CenterTopBarProps) {
  return (
    <header className={styles.bar} data-testid="center-top-bar">
      <button
        type="button"
        className={styles.search}
        onClick={onOpenSearch}
        aria-label="Search markets"
        data-testid="center-search-button"
      >
        <Search size={18} strokeWidth={2} aria-hidden="true" />
        <span className={styles.searchLabel}>Search markets</span>
      </button>

      <div className={styles.right}>
        {authenticated ? (
          <AccountAvatarTrigger />
        ) : (
          <>
            <button
              type="button"
              className={styles.logIn}
              onClick={onLogIn}
              data-testid="center-log-in"
            >
              Log In
            </button>
            <button
              type="button"
              className={styles.createAccount}
              onClick={onCreateAccount}
              data-testid="center-create-account"
            >
              Create Account
            </button>
          </>
        )}
      </div>
    </header>
  )
}
