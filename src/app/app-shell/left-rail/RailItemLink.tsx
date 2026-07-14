import { NavLink } from 'react-router-dom'
import { railItemTo } from './left-rail.utils'
import styles from './left-rail.module.css'
import type { RailAction, ResolvedRailItem } from './left-rail.types'

const ICON_PX = 18

/** One rail nav row. Mailto items render as a plain anchor; action items (which
 * open a modal rather than navigate) render as a button; lobby/route items
 * render as a `NavLink` whose active styling is driven by the hook-resolved
 * `active` flag (not NavLink's own matcher, which can't distinguish `?view=`). */
export function RailItemLink({
  resolved,
  onAction,
}: {
  resolved: ResolvedRailItem
  onAction: (action: RailAction) => void
}) {
  const { item, active } = resolved
  const Icon = item.icon
  const rowClass = active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem

  if (item.kind === 'mailto') {
    return (
      <a className={styles.navItem} href={item.href} data-testid={`rail-item-${item.key}`}>
        <Icon size={ICON_PX} strokeWidth={2} className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{item.label}</span>
      </a>
    )
  }

  if (item.kind === 'action') {
    return (
      <button
        type="button"
        className={styles.navItem}
        onClick={() => onAction(item.action)}
        data-testid={`rail-item-${item.key}`}
      >
        <Icon size={ICON_PX} strokeWidth={2} className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{item.label}</span>
      </button>
    )
  }

  return (
    <NavLink
      className={rowClass}
      to={railItemTo(item)}
      data-testid={`rail-item-${item.key}`}
      data-active={active ? 'true' : 'false'}
    >
      <Icon size={ICON_PX} strokeWidth={2} className={styles.navIcon} aria-hidden="true" />
      <span className={styles.navLabel}>{item.label}</span>
    </NavLink>
  )
}
