import { Target } from 'lucide-react'
import styles from './simple-order-ticket.module.css'
import { PRICE_TARGET_LABEL } from './order-entry.constants'
import type { PriceTargetToggleProps } from './order-entry.types'

/**
 * Simple mode's only limit affordance: off ⇒ the order is a market, on ⇒ it
 * becomes a limit at the price you name. Keeping it a toggle rather than an
 * order-type picker is what keeps Simple simple — there is no stop, no TWAP, no
 * time-in-force to reason about.
 */
export function PriceTargetToggle({ isOn, onToggle }: PriceTargetToggleProps) {
  return (
    <button
      type="button"
      className={isOn ? `${styles.targetToggle} ${styles.targetToggleOn}` : styles.targetToggle}
      onClick={onToggle}
      aria-pressed={isOn}
      data-testid="price-target-toggle"
    >
      <Target size={14} strokeWidth={2} aria-hidden="true" />
      <span>{PRICE_TARGET_LABEL}</span>
    </button>
  )
}
