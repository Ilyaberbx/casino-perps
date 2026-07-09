import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './pnl-card-modal.module.css'
import type { PnlCardStepperProps } from './pnl-card.types'

// A single labelled arrow stepper — `[◀]  LABEL / value  [▶]`. The left arrow
// retreats the ring (`onStep(-1)`), the right advances it (`onStep(1)`); both
// wrap around at the owner (the modal hook). Dumb: the hook owns the ring walk.
export function PnlCardStepper({ label, value, ariaLabel, onStep }: PnlCardStepperProps) {
  return (
    <div className={styles.stepper} role="group" aria-label={ariaLabel}>
      <PixelButton
        variant="default"
        size="sm"
        elevated
        aria-label={`Previous ${label}`}
        onClick={() => onStep(-1)}
      >
        ◀
      </PixelButton>
      <span className={styles.stepperReadout}>
        <span className={styles.stepperLabel}>{label}</span>
        <span className={styles.stepperValue}>{value}</span>
      </span>
      <PixelButton
        variant="default"
        size="sm"
        elevated
        aria-label={`Next ${label}`}
        onClick={() => onStep(1)}
      >
        ▶
      </PixelButton>
    </div>
  )
}
