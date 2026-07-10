import { NavLink } from 'react-router-dom'
import { railItemTo } from './left-rail.utils'
import styles from './left-rail.module.css'
import type { ResolvedRailItem } from './left-rail.types'

const ICON_PX = 18

/** One rail nav row. Mailto items render as a plain anchor; lobby/route items
 * render as a `NavLink` whose active styling is driven by the hook-resolved
 * `active` flag (not NavLink's own matcher, which can't distinguish `?view=`). */
export function RailItemLink({ resolved }: { resolved: ResolvedRailItem }) {
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
