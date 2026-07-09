import { ErrorSubCard } from './ErrorSubCard'
import { StepIcon } from './StepIcon'
import styles from './venue-onboarding-sheet.module.css'
import type { StepRowProps } from './venue-onboarding-sheet.types'

export function StepRow({
  step,
  index,
  actions,
  onRetry,
  onResetLocalState,
}: StepRowProps) {
  const isError = typeof step.status === 'object' && step.status.kind === 'error'

  return (
    <li className={styles.step} data-testid={`step-row-${step.id}`}>
      <StepIcon index={index} status={step.status} />
      <div className={styles.stepBody}>
        <p className={styles.stepLabel}>{step.label}</p>
        <p className={styles.stepDescription}>{step.description}</p>
        {isError && typeof step.status === 'object' && (
          <ErrorSubCard
            stepId={step.id}
            status={step.status}
            actions={actions}
            onRetry={onRetry}
            onResetLocalState={onResetLocalState}
          />
        )}
      </div>
    </li>
  )
}
