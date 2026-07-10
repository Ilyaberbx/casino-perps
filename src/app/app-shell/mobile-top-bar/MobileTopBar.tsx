import { Menu, Wallet } from 'lucide-react'
import { Wordmark } from '@/modules/shared/components/wordmark'
import styles from './mobile-top-bar.module.css'
import type { MobileTopBarProps } from './mobile-top-bar.types'

/**
 * The mobile top bar (PRD 0008 §6, shown < 900px): wordmark, a cash / Add Cash
 * pill, and the hamburger that opens the rail drawer. Auth (account / Log In)
 * lives inside that drawer so the bar stays to these three controls. Dumb —
 * handlers come from the shell.
 */
export function MobileTopBar({ onAddCash, onOpenMenu }: MobileTopBarProps) {
  return (
    <header className={styles.bar} data-testid="mobile-top-bar">
      <Wordmark size="sm" className={styles.wordmark} />

      <div className={styles.right}>
        <button
          type="button"
          className={styles.cashPill}
          onClick={onAddCash}
          data-testid="mobile-add-cash"
        >
          <Wallet size={15} strokeWidth={2} aria-hidden="true" />
          Add Cash
        </button>

        <button
          type="button"
          className={styles.hamburger}
          onClick={onOpenMenu}
          aria-label="Open menu"
          data-testid="mobile-menu-button"
        >
          <Menu size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
