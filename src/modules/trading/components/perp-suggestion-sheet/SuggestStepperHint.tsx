import {
  STEP_STATUS_MARK,
  STEP_STATUS_WORD,
  STEPPER_HINT_TITLE,
} from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestStepperHintProps } from './perp-suggestion-sheet.types'

/**
 * The Suggest stepper's hover/focus hint (Item 1): a pixel-styled panel breaking
 * the progress bar down into its six steps — DEX → Token → Params → Estimate →
 * Execute → Preview — each marked done / now / next so the trader can see exactly
 * what the bar's fill represents and what is left. Dumb leaf: it attaches the
 * `Popover` panel ref to its root and renders the steps it is handed.
 */
export function SuggestStepperHint({ steps, panelRef }: SuggestStepperHintProps) {
  return (
    <div
      ref={panelRef}
      className={styles.stepperHint}
      role="tooltip"
      data-testid="stepper-hint"
    >
      <p className={styles.stepperHintTitle}>{STEPPER_HINT_TITLE}</p>
      <ul className={styles.stepperHintList}>
        {steps.map((step) => (
          <li
            key={step.id}
            className={styles.stepperHintRow}
            data-status={step.status}
          >
            <span className={styles.stepperHintMark} aria-hidden="true">
              {STEP_STATUS_MARK[step.status]}
            </span>
            <span className={styles.stepperHintLabel}>{step.label}</span>
            <span className={styles.stepperHintWord}>
              {STEP_STATUS_WORD[step.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
