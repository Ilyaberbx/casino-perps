import { FlowErrorCallout } from '../shared-flow/FlowErrorCallout'
import styles from './send-flow.module.css'
import {
  SEND_COPY,
  SEND_ERROR_LABEL,
  SEND_ERROR_PROSE,
  SEND_STATUS_ROLE,
} from './send-flow.constants'
import { useSendFlowBody } from './use-send-flow-body'
import { SendForm } from './SendForm'
import { SendReview } from './SendReview'
import { SendSuccess } from './SendSuccess'

/**
 * The dumb HL send body (the `body: FC` the venue exposes via
 * `VenueSendCapability`). A two-step flow: `form` (token + amount + recipient) →
 * `review` (read-only confirm + sign) → `sent` (instant ✓ + Done). On `error` it
 * swaps in an inline `SendErrorCallout` + retry (input preserved). The smart
 * `useSendFlowBody` hook owns all state. `aria-live="polite"` so a screen-reader
 * hears the phase transitions non-visually.
 */
export function SendFlow() {
  const { flow, recipient } = useSendFlowBody()

  const showError = flow.phase === 'error' && flow.errorReason !== null

  return (
    <div className={styles.body} role={SEND_STATUS_ROLE} aria-live="polite">
      <h2 className={styles.title}>{SEND_COPY.title}</h2>

      {showError && flow.errorReason !== null && (
        <FlowErrorCallout
          styles={styles}
          label={SEND_ERROR_LABEL}
          prose={SEND_ERROR_PROSE[flow.errorReason]}
          retryCta={SEND_COPY.retryCta}
          onRetry={flow.retry}
        />
      )}

      {flow.phase === 'form' && (
        <SendForm
          tokens={flow.tokens}
          selectedTokenKey={flow.selectedTokenKey}
          symbol={flow.symbol}
          available={flow.available}
          amount={flow.amount}
          isAmountValid={flow.isAmountValid}
          amountInvalidReason={flow.amountInvalidReason}
          destination={flow.destination}
          isDestinationValid={flow.isDestinationValid}
          recipient={recipient}
          canReview={flow.canReview}
          assetsStatus={flow.assetsStatus}
          onSelectToken={flow.selectToken}
          onRetryAssets={flow.retryAssets}
          onAmountChange={flow.setAmount}
          onMax={flow.setAmountToMax}
          onPercent={flow.setPercent}
          onReview={flow.review}
        />
      )}

      {(flow.phase === 'review' || flow.phase === 'signing') && (
        <SendReview
          amount={flow.amount}
          symbol={flow.symbol}
          destination={flow.destination}
          isSigning={flow.phase === 'signing'}
          onBack={flow.back}
          onSign={flow.submit}
        />
      )}

      {flow.phase === 'sent' && (
        <SendSuccess amount={flow.amount} symbol={flow.symbol} onDone={flow.reset} />
      )}
    </div>
  )
}
