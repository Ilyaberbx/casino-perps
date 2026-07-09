import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './deposit-flow.module.css'
import { DEPOSIT_COPY, DEPOSIT_ERROR_LABEL, DEPOSIT_ERROR_PROSE } from './deposit-flow.constants'
import type { DepositErrorCalloutProps } from './deposit-flow.types'

/**
 * Inline error surface for every pre-broadcast failure reason. Plain-language
 * cause + a retry affordance. Never a dead-end (the entered amount is preserved
 * by the machine, so retry re-runs the pre-flight without losing input).
 */
export function DepositErrorCallout({ reason, onRetry }: DepositErrorCalloutProps) {
  return (
    <div className={styles.track}>
      <Callout variant="error" label={DEPOSIT_ERROR_LABEL}>
        {DEPOSIT_ERROR_PROSE[reason]}
      </Callout>
      <PixelButton variant="accentFilled" fullWidth onClick={onRetry}>
        {DEPOSIT_COPY.retryCta}
      </PixelButton>
    </div>
  )
}
