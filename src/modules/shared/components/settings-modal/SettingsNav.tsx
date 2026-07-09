import styles from './settings-modal.module.css'
import type { SettingsNavProps } from './settings-modal.types'

const ICON_SIZE = 16

/**
 * Dumb left rail (desktop) / horizontal scroll strip (mobile). One button per
 * section — label + lucide icon. The active item gets the accent; the active
 * button carries `aria-current="page"`. The mobile strip is driven by a class
 * the parent toggles from `isMobile`. Mirrors `ManageFundsNav`.
 */
export function SettingsNav({ sections, activeSection, onSelect, isMobile }: SettingsNavProps) {
  const navClass = isMobile ? `${styles.nav} ${styles.navMobile}` : styles.nav

  return (
    <nav className={navClass} aria-label="Settings sections">
      {sections.map((section) => {
        const { Icon } = section
        const isActive = section.id === activeSection
        const buttonClass = isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
        return (
          <button
            key={section.id}
            type="button"
            className={buttonClass}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`settings-nav-${section.id}`}
            onClick={() => onSelect(section.id)}
          >
            <Icon size={ICON_SIZE} />
            <span className={styles.navLabel}>{section.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
