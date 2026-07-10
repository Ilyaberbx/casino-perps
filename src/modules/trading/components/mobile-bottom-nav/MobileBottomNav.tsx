import { NavLink } from 'react-router-dom'
import { useMobileBottomNav } from './use-mobile-bottom-nav'
import type { MobileBottomNavProps, NavIcon } from './mobile-bottom-nav.types'
import styles from './mobile-bottom-nav.module.css'

const ICON_PX = 20

/** The cell glyph: a Lucide line icon in `currentColor`, tracking the cell's
 * muted/active color. */
function NavCellIcon({ icon }: { icon: NavIcon }) {
  const Icon = icon.Icon
  return <Icon size={ICON_PX} strokeWidth={2} className={styles.icon} aria-hidden="true" />
}

/**
 * The casino mobile bottom tab bar (PRD 0008 §6, D8): exactly four tabs —
 * Browse, Markets, My Bets, Chat. Browse and My Bets navigate; Markets and Chat
 * open the search overlay and chat sheet via injected handlers. Fixed to the
 * viewport bottom and shown only under 900px (the shell owns it). Dumb — state
 * comes from {@link useMobileBottomNav}.
 */
export function MobileBottomNav({ onOpenSearch, onOpenChat }: MobileBottomNavProps) {
  const { cells } = useMobileBottomNav({ onOpenSearch, onOpenChat })

  return (
    <nav className={styles.nav} aria-label="Primary" data-testid="mobile-bottom-nav">
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
