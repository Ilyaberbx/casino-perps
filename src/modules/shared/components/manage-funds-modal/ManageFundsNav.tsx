import styles from './manage-funds-modal.module.css'
import type { ManageFundsNavProps } from './manage-funds-modal.types'

const ICON_SIZE = 16

/**
 * Dumb left rail (desktop) / horizontal scroll strip (mobile). One button per
 * tab — label + lucide icon. The active item gets the cyan accent; everything
 * else stays calm. Keyboard-navigable via native button semantics; the active
 * button carries `aria-current="page"`. The mobile strip is driven by a
 * className the parent toggles from `isMobile`.
 */
export function ManageFundsNav({
  tabs,
  activeTab,
  onSelect,
  isMobile,
}: ManageFundsNavProps) {
  const navClass = isMobile ? `${styles.nav} ${styles.navMobile}` : styles.nav

  return (
    <nav className={navClass} aria-label="Manage funds sections">
      {tabs.map((tab) => {
        const { Icon } = tab
        const isActive = tab.id === activeTab
        const buttonClass = isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
        return (
          <button
            key={tab.id}
            type="button"
            className={buttonClass}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <Icon size={ICON_SIZE} />
            <span className={styles.navLabel}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
