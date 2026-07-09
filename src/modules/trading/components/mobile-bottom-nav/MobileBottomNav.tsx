import { NavLink } from 'react-router-dom'
import { AiMascot } from '@/modules/shared/components/ai-marker'
import { useMobileBottomNav } from './use-mobile-bottom-nav'
import type { MobileBottomNavProps, NavIcon } from './mobile-bottom-nav.types'
import styles from './mobile-bottom-nav.module.css'

const ICON_PX = 18

/** The cell glyph: the brand AI mascot for Ask AI, a Lucide line icon otherwise.
 * Both paint in `currentColor`, so they track the cell's muted/active color. */
function NavCellIcon({ icon }: { icon: NavIcon }) {
  if (icon.kind === 'ai') {
    return <AiMascot size={ICON_PX} className={styles.icon} />
  }
  const Icon = icon.Icon
  return <Icon size={ICON_PX} strokeWidth={2} className={styles.icon} aria-hidden="true" />
}

/**
 * The mobile footer: two route cells (Trade, Portfolio) plus three action cells
 * (Ask AI, Account, Settings). Ask AI opens the suggestion sheet; Account opens
 * the account modal (or the connect-wallet flow when disconnected); Settings
 * opens the Settings modal. Action handlers are injected by the page so the nav
 * stays dumb and testable in isolation.
 */
export function MobileBottomNav({ onAskAi, onAccount, onSettings }: MobileBottomNavProps) {
  const { cells } = useMobileBottomNav({ onAskAi, onAccount, onSettings })

  return (
    <nav className={styles.nav} aria-label="Primary">
      {cells.map((cell) => {
        const iconSlot = (
          <span className={styles.iconSlot} aria-hidden="true">
            <NavCellIcon icon={cell.icon} />
          </span>
        )

        if (cell.kind === 'link') {
          return (
            <NavLink
              key={cell.key}
              to={cell.to}
              data-testid={cell.testId}
              data-active={cell.active ? 'true' : 'false'}
              className={cell.active ? `${styles.cell} ${styles.cellActive}` : styles.cell}
            >
              {iconSlot}
              <span className={styles.label}>{cell.label}</span>
            </NavLink>
          )
        }

        return (
          <button
            key={cell.key}
            type="button"
            data-testid={cell.testId}
            onClick={cell.onClick}
            className={styles.cell}
          >
            {iconSlot}
            <span className={styles.label}>{cell.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
