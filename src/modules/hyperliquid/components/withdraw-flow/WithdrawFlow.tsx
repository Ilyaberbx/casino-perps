import { FlowErrorCallout } from '../shared-flow/FlowErrorCallout'
import styles from './withdraw-flow.module.css'
import {
  WITHDRAW_COPY,
  WITHDRAW_ERROR_LABEL,
  WITHDRAW_ERROR_PROSE,
  WITHDRAW_STATUS_ROLE,
} from './withdraw-flow.constants'
import { useWithdrawFlowBody } from './use-withdraw-flow-body'
import { WithdrawForm } from './WithdrawForm'
import { WithdrawReview } from './WithdrawReview'
import { WithdrawArrivalTrack } from './WithdrawArrivalTrack'

/**
 * The dumb HL withdraw body (the `body: FC` the venue exposes via
 * `VenueWithdrawCapability`). A two-step flow: `form` (amount + destination +
 * irreversible confirm) → `review` (read-only confirm + sign) → `sent` (arrival
 * track + Done). On `error` it swaps in an inline `WithdrawErrorCallout` + retry
 * (input preserved). The smart `useWithdrawFlowBody` hook owns all state.
 * `aria-live="polite"` so a screen-reader hears the phase transitions non-visually.
 */
export function WithdrawFlow() {
  const { flow, recipient } = useWithdrawFlowBody()

  const showError = flow.phase === 'error' && flow.errorReason !== null

  return (
    <div className={styles.body} role={WITHDRAW_STATUS_ROLE} aria-live="polite">
      <h2 className={styles.title}>{WITHDRAW_COPY.title}</h2>

      {showError && flow.errorReason !== null && (
        <FlowErrorCallout
          styles={styles}
          label={WITHDRAW_ERROR_LABEL}
          prose={WITHDRAW_ERROR_PROSE[flow.errorReason]}
          retryCta={WITHDRAW_COPY.retryCta}
          onRetry={flow.retry}
        />
      )}

      {flow.phase === 'form' && (
        <WithdrawForm
          amount={flow.amount}
          isAmountValid={flow.isAmountValid}
          amountInvalidReason={flow.amountInvalidReason}
          withdrawable={flow.withdrawable}
          recipient={recipient}
          isDestinationEdited={flow.isDestinationEdited}
          confirmedIrreversible={flow.confirmedIrreversible}
          fee={flow.fee}
          minWithdraw={flow.minWithdraw}
          netReceived={flow.netReceived}
          canReview={flow.canReview}
          onAmountChange={flow.setAmount}
          onMax={flow.setAmountToMax}
          onPercent={flow.setPercent}
          onToggleConfirm={flow.toggleConfirmIrreversible}
          onReview={flow.review}
        />
      )}

      {(flow.phase === 'review' || flow.phase === 'signing') && (
        <WithdrawReview
          amount={flow.amount}
          destination={flow.destination}
          fee={flow.fee}
          netReceived={flow.netReceived}
          isSigning={flow.phase === 'signing'}
          onBack={flow.back}
          onSign={flow.submit}
        />
      )}

      {flow.phase === 'sent' && <WithdrawArrivalTrack onDone={flow.reset} />}
    </div>
  )
}
