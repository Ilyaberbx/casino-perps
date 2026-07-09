import styles from './onboarding-stepper.module.css'
import type { StepIndicatorProps } from './step-indicator.types'

/** `●●○○  Step N of M` progress indicator (PRD-0006 UI-1). */
export function StepIndicator({ current, total }: StepIndicatorProps) {
  const dots = Array.from({ length: total }, (_, i) => i < current)
  return (
    <div className={styles.indicator}>
      <span className={styles.dots} aria-hidden="true">
        {dots.map((filled, i) => (
          <span key={i} className={filled ? `${styles.dot} ${styles.dotFilled}` : styles.dot} />
        ))}
      </span>
      <span>
        Step {current} of {total}
      </span>
    </div>
  )
}
