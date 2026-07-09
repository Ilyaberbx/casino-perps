import styles from './evm-core-flow.module.css'
import { EVM_CORE_COPY, EVM_CORE_DIRECTION_OPTIONS } from './evm-core-flow.constants'
import type { EvmCoreDirectionToggleProps } from './evm-core-flow.types'

/**
 * The Core→EVM / EVM→Core direction toggle. A two-segment control; the active
 * direction is accent-bordered. Both directions are live. The parent's hook owns
 * the direction state (switching it resets the amount + re-runs EVM preflight).
 */
export function EvmCoreDirectionToggle({ direction, onSelect }: EvmCoreDirectionToggleProps) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{EVM_CORE_COPY.directionLabel}</span>
      <div
        className={styles.directionToggle}
        role="group"
        aria-label={EVM_CORE_COPY.directionLabel}
      >
        {EVM_CORE_DIRECTION_OPTIONS.map((option) => {
          const isActive = option.direction === direction
          const className = isActive
            ? `${styles.directionButton} ${styles.directionButtonActive}`
            : styles.directionButton
          return (
            <button
              key={option.direction}
              type="button"
              className={className}
              disabled={!option.enabled}
              aria-pressed={isActive}
              onClick={() => onSelect(option.direction)}
            >
              <span>{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
