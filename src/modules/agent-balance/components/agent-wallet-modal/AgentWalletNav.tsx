import styles from './agent-wallet-modal.module.css'
import type { AgentWalletNavProps } from './agent-wallet-modal.types'

const ICON_SIZE = 16

/**
 * Dumb left rail (desktop) / horizontal scroll strip (mobile) for the Agent
 * Wallet modal. One button per flow (Deposit / Withdraw / Signing); the active
 * one gets the cyan accent and `aria-current="page"`. Mirrors `ManageFundsNav`.
 */
export function AgentWalletNav({ tabs, activeMode, isMobile, onSelect }: AgentWalletNavProps) {
  const navClass = isMobile ? `${styles.nav} ${styles.navMobile}` : styles.nav

  return (
    <nav className={navClass} aria-label="Agent wallet sections">
      {tabs.map((tab) => {
        const { Icon } = tab
        const isActive = tab.mode === activeMode
        const buttonClass = isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
        return (
          <button
            key={tab.mode}
            type="button"
            className={buttonClass}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(tab.mode)}
          >
            <Icon size={ICON_SIZE} />
            <span className={styles.navLabel}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
