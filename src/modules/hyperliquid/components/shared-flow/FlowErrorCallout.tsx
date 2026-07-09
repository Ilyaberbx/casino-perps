import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import type { FlowErrorCalloutProps } from './shared-flow.types'

/**
 * Inline error surface for a flow failure. Plain-language cause + a retry
 * affordance. Never a dead-end — each flow's machine preserves the entered
 * input, so retry re-opens the form intact. Shared by the send / withdraw /
 * evm-core bodies: the per-flow `styles`, error `label`, resolved `prose`, and
 * `retryCta` copy are passed as props so the DOM + class hooks stay identical.
 */
export function FlowErrorCallout({
  styles,
  label,
  prose,
  retryCta,
  onRetry,
}: FlowErrorCalloutProps) {
  return (
    <div className={styles.track}>
      <Callout variant="error" label={label}>
        {prose}
      </Callout>
      <PixelButton variant="accentFilled" fullWidth onClick={onRetry}>
        {retryCta}
      </PixelButton>
    </div>
  )
}
