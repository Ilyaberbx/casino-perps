import styles from './venue-onboarding-sheet.module.css'
import type { StepIconProps } from './venue-onboarding-sheet.types'

/**
 * 24px square step indicator. Four states: pending (outline + step number),
 * running (outline + 8-frame stepped spinner), complete (filled success +
 * check), error (outline danger + ⊘ glyph).
 */
export function StepIcon({ index, status }: StepIconProps) {
  if (status === 'pending') {
    return (
      <span
        className={`${styles.stepIcon} ${styles.iconPending}`}
        data-testid="step-icon-pending"
        aria-label={`Step ${index + 1} pending`}
      >
        {index + 1}
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span
        className={`${styles.stepIcon} ${styles.iconRunning}`}
        data-testid="step-icon-running"
        aria-label={`Step ${index + 1} running`}
      >
        <span className={styles.iconSpinner} aria-hidden="true" />
      </span>
    )
  }

  if (status === 'complete') {
    return (
      <span
        className={`${styles.stepIcon} ${styles.iconComplete}`}
        data-testid="step-icon-complete"
        aria-label={`Step ${index + 1} complete`}
      >
        ✓
      </span>
    )
  }

  return (
    <span
      className={`${styles.stepIcon} ${styles.iconError}`}
      data-testid="step-icon-error"
      aria-label={`Step ${index + 1} error`}
    >
      ⊘
    </span>
  )
}
