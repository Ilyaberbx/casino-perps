import { PanelLeftClose, Wallet } from 'lucide-react'
import { Wordmark } from '@/modules/shared/components/wordmark'
import { useLeftRail } from './use-left-rail'
import { RailItemLink } from './RailItemLink'
import { PaymentStrip } from './PaymentStrip'
import { RAIL_SEGMENTS } from './left-rail.constants'
import styles from './left-rail.module.css'
import type { LeftRailProps } from './left-rail.types'

/**
 * The left rail (PRD 0008 §6, D8). Fixed 265px column: wordmark, the
 * Perps/Soon segmented control, three nav groups, a collapse button, the
 * outlined ADD CASH button, and the decorative payment strip. Dumb component —
 * `useLeftRail` resolves active state; actions come in as props.
 */
export function LeftRail({ onAddCash, onCollapse }: LeftRailProps) {
  const { groups } = useLeftRail()

  return (
    <div className={styles.rail} data-testid="left-rail">
      <div className={styles.header}>
        <Wordmark size="lg" className={styles.wordmark} />
      </div>

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

      <nav className={styles.nav} aria-label="Rail">
        {groups.map((group) => (
          <div key={group.key} className={styles.group}>
            {group.label ? <span className={styles.groupLabel}>{group.label}</span> : null}
            {group.items.map((resolved) => (
              <RailItemLink key={resolved.item.key} resolved={resolved} />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.collapseButton}
          onClick={onCollapse}
          aria-label="Collapse menu"
          data-testid="rail-collapse"
        >
          <PanelLeftClose size={16} strokeWidth={2} aria-hidden="true" />
        </button>

        <button
          type="button"
          className={styles.addCash}
          onClick={onAddCash}
          data-testid="rail-add-cash"
        >
          <Wallet size={16} strokeWidth={2} aria-hidden="true" />
          Add Cash
        </button>

        <PaymentStrip />
      </div>
    </div>
  )
}
