import { PanelLeftClose, PanelLeftOpen, Wallet } from 'lucide-react'
import { Wordmark } from '@/modules/shared/components/wordmark'
import { useLeftRail } from './use-left-rail'
import { RailItemLink } from './RailItemLink'
import { RAIL_SEGMENTS } from './left-rail.constants'
import styles from './left-rail.module.css'
import type { LeftRailProps } from './left-rail.types'

/**
 * The left rail (PRD 0008 §6, D8). Fixed 265px column: wordmark, the
 * Perps/Soon segmented control, three nav groups, a collapse toggle, and the
 * outlined ADD CASH button. `collapsed` renders the icon-only 76px variant
 * (labels, segments, and the wordmark hide; the toggle flips to re-open).
 * Dumb component — `useLeftRail` resolves active state; actions come in as
 * props.
 */
export function LeftRail({ collapsed, onAddCash, onCollapse, onRailAction }: LeftRailProps) {
  const { groups } = useLeftRail()

  const railClass = collapsed ? `${styles.rail} ${styles.railCollapsed}` : styles.rail
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <div className={railClass} data-testid="left-rail" data-collapsed={collapsed || undefined}>
      {!collapsed && (
        <div className={styles.header}>
          <Wordmark size="lg" className={styles.wordmark} />
        </div>
      )}

      {!collapsed && (
        <div className={styles.segmented} role="group" aria-label="Product">
          {RAIL_SEGMENTS.map((segment) => (
            <button
              key={segment.value}
              type="button"
              className={
                segment.disabled
                  ? `${styles.segment} ${styles.segmentDisabled}`
                  : `${styles.segment} ${styles.segmentActive}`
              }
              disabled={segment.disabled}
              aria-pressed={!segment.disabled}
              data-testid={`rail-segment-${segment.value}`}
            >
              {segment.label}
            </button>
          ))}
        </div>
      )}

      <nav className={styles.nav} aria-label="Rail">
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            {group.label && !collapsed ? (
              <span className={styles.groupLabel}>{group.label}</span>
            ) : null}
            {group.items.map((resolved) => (
              <RailItemLink
                key={resolved.item.key}
                resolved={resolved}
                onAction={onRailAction}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onCollapse}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          data-testid="rail-collapse"
        >
          <CollapseIcon size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.addCash}
          onClick={onAddCash}
          aria-label="Add Cash"
          data-testid="rail-add-cash"
        >
          <Wallet size={16} strokeWidth={2} aria-hidden="true" />
          {!collapsed && <span>Add Cash</span>}
        </button>
      </div>
    </div>
  )
}
