import styles from './account-modal.module.css'
import type { AccountModalNavProps } from './account-modal.types'

/**
 * The Account Modal navigation: a left sidebar on desktop, a horizontal top tab
 * strip on mobile (PRD-0006 UI-2). One nav model rendered two ways — the parent's
 * smart hook owns the active section and the `isMobile` boundary.
 */
export function AccountModalNav({
  isMobile,
  activeSection,
  navItems,
  onSelectSection,
}: AccountModalNavProps) {
  const navClass = isMobile ? styles.tabs : styles.sidebar

  return (
    <nav className={navClass} aria-label="Account sections">
      {navItems.map((item) => {
        const isActive = item.id === activeSection
        const itemClass = isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
        return (
          <button
            key={item.id}
            type="button"
            data-testid={`account-nav-${item.id}`}
            className={itemClass}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelectSection(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
