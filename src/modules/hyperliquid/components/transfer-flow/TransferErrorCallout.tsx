import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './transfer-flow.module.css'
import {
  TRANSFER_COPY,
  TRANSFER_ERROR_LABEL,
  TRANSFER_ERROR_PROSE,
} from './transfer-flow.constants'
import type { TransferErrorCalloutProps } from './transfer-flow.types'

/**
 * Inline error surface for every transfer failure reason. Plain-language cause +
 * a retry affordance. Never a dead-end — the entered amount + direction are
 * preserved by the machine, so retry re-opens the form with input intact.
 */
export function TransferErrorCallout({ reason, onRetry }: TransferErrorCalloutProps) {
  return (
    <div className={styles.track}>
      <Callout variant="error" label={TRANSFER_ERROR_LABEL}>
        {TRANSFER_ERROR_PROSE[reason]}
      </Callout>
      <PixelButton variant="accentFilled" fullWidth onClick={onRetry}>
        {TRANSFER_COPY.retryCta}
      </PixelButton>
    </div>
  )
}
