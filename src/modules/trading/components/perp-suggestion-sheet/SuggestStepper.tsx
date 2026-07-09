import { Popover } from '@/modules/shared/components/popover'
import { STEPPER_ARIA_LABEL } from './perp-suggestion-sheet.constants'
import { suggestProgressStyle } from './perp-suggestion-sheet.styles'
import { useSuggestStepper } from './use-suggest-stepper'
import { SuggestStepperHint } from './SuggestStepperHint'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestStepperProps } from './perp-suggestion-sheet.types'

/**
 * The Suggest flow's progress indicator (slice 09): DEX → Token → Params →
 * Estimate → Execute → Preview. A single pixel-art bar that fills as steps
 * complete, with one label that changes per step plus an `N/total` counter — the
 * blocky fill + hard borders match the shared `PixelSlider` grammar. The fill
 * tracks completed steps; the label/counter track the current step. Dumb — fed
 * the derived `steps`; the runtime fill width comes from `suggestProgressStyle`.
 */
export function SuggestStepper({ steps }: SuggestStepperProps) {
  const { isHintOpen, triggerRef, hintRef, open, close } = useSuggestStepper()

  if (steps.length === 0) return null

  const total = steps.length
  const completeCount = steps.filter((step) => step.status === 'complete').length
  const currentIndex = steps.findIndex((step) => step.status === 'current')
  const activeIndex = currentIndex === -1 ? total - 1 : currentIndex
  const activeStep = steps[activeIndex]
  const position = activeIndex + 1
  const fillFraction = completeCount / total

  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={STEPPER_ARIA_LABEL}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completeCount}
      aria-valuetext={`${activeStep.label}, step ${position} of ${total}`}
      data-testid="suggest-stepper"
      ref={triggerRef}
      tabIndex={0}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      <div className={styles.progressHeader}>
        <span className={styles.progressLabel} data-testid="progress-label">
          {activeStep.label}
        </span>
        <span className={styles.progressCount} data-testid="progress-count">
          {position}/{total}
        </span>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <div
          className={styles.progressFill}
          style={suggestProgressStyle(fillFraction)}
        />
      </div>
      {isHintOpen ? (
        <Popover anchorRef={triggerRef} panelRef={hintRef} placement="bottom-start">
          <SuggestStepperHint steps={steps} panelRef={hintRef} />
        </Popover>
      ) : null}
    </div>
  )
}
