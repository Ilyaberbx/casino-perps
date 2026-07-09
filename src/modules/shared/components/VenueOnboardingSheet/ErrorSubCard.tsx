import { PixelButton } from '../pixel-button'
import { resolveCta } from './venue-onboarding-sheet.utils'
import styles from './venue-onboarding-sheet.module.css'
import type { ErrorSubCardProps } from './venue-onboarding-sheet.types'

export function ErrorSubCard({
  stepId,
  status,
  actions,
  onRetry,
  onResetLocalState,
}: ErrorSubCardProps) {
  const resolved = resolveCta(status.cta, stepId, actions, onRetry, onResetLocalState)
  const hasCauseChain = status.causeChain !== undefined && status.causeChain.length > 0

  return (
    <div className={styles.errorCard} data-testid={`error-card-${stepId}`}>
      <p className={styles.errorHeadline}>{status.headline}</p>
      <p className={styles.errorCopy}>{status.copy}</p>
      {resolved.kind === 'link' ? (
        <PixelButton
          as="a"
          variant="default"
          size="sm"
          href={resolved.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {resolved.label}
        </PixelButton>
      ) : (
        <PixelButton type="button" variant="default" size="sm" onClick={resolved.onClick}>
          {resolved.label}
        </PixelButton>
      )}
      <details className={styles.detailsToggle}>
        <summary>Show details</summary>
        <pre className={styles.causeChain}>
          {hasCauseChain ? status.causeChain : status.reason}
        </pre>
      </details>
    </div>
  )
}
