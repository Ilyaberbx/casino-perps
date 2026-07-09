import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { useRecipientCombobox } from '@/modules/shared/components/recipient-combobox'
import styles from './withdraw-flow.module.css'
import { useWithdrawFlow, type WithdrawFlowDeps } from './use-withdraw-flow'
import { WithdrawForm } from './WithdrawForm'
import {
  WITHDRAW_COPY,
  WITHDRAW_ERROR_CTA,
  WITHDRAW_ERROR_PROSE,
  WITHDRAW_NON_FAILURE_REASONS,
} from './withdraw-flow.constants'

/**
 * Dumb withdraw body for the Agent Balance on Base. Structurally matched to the
 * Hyperliquid withdraw form (shared `AmountInput` + percent chips + destination +
 * irreversible-confirm gate + summary) while keeping the EXPLICIT per-action
 * authorization seam — a fresh signature, never the standing delegation
 * (ADR-0046 D-7). A single `editing` step; on `error` it swaps in an inline
 * retry callout (input preserved); `sent` shows the mined confirmation. The smart
 * `useWithdrawFlow` hook owns all state.
 */
export function WithdrawFlow(deps: WithdrawFlowDeps) {
  const vm = useWithdrawFlow(deps)

  const showDestinationInvalid = vm.isDestinationEdited && !vm.isDestinationValid
  const recipient = useRecipientCombobox({
    value: vm.destination,
    walletSuggestions: vm.walletSuggestions,
    recentSuggestions: vm.recentSuggestions,
    onChange: vm.setDestination,
    inputId: 'agent-withdraw-destination',
    label: WITHDRAW_COPY.destinationLabel,
    hint: null,
    ariaLabel: 'Withdraw destination Base address',
    placeholder: WITHDRAW_COPY.destinationPlaceholder,
    isInvalid: showDestinationInvalid,
    invalidReason: showDestinationInvalid ? WITHDRAW_COPY.destinationInvalid : null,
  })

  const showError = vm.phase === 'error' && vm.errorReason !== null
  const showForm = vm.phase === 'editing' || vm.phase === 'authorizing'
  const isNonFailure = vm.errorReason !== null && WITHDRAW_NON_FAILURE_REASONS.has(vm.errorReason)

  return (
    <div className={styles.flow} aria-label="Withdraw from Agent Balance">
      <p className={styles.lead}>{WITHDRAW_COPY.lead}</p>

      {showError && vm.errorReason !== null && (
        <div className={styles.track}>
          <Callout
            variant={isNonFailure ? 'info' : 'error'}
            label={isNonFailure ? WITHDRAW_COPY.statusLabel : WITHDRAW_COPY.errorLabel}
          >
            {WITHDRAW_ERROR_PROSE[vm.errorReason]}
          </Callout>
          <PixelButton variant="accentFilled" fullWidth onClick={vm.retry}>
            {WITHDRAW_ERROR_CTA[vm.errorReason]}
          </PixelButton>
        </div>
      )}

      {showForm && (
        <WithdrawForm
          amount={vm.amount}
          isAmountValid={vm.isAmountValid}
          amountInvalidReason={vm.amountInvalidReason}
          withdrawable={vm.withdrawable}
          recipient={recipient}
          isDestinationEdited={vm.isDestinationEdited}
          confirmedIrreversible={vm.confirmedIrreversible}
          minWithdraw={vm.minWithdraw}
          netReceived={vm.netReceived}
          canSubmit={vm.canSubmit}
          isAuthorizing={vm.phase === 'authorizing'}
          onAmountChange={vm.setAmount}
          onMax={vm.setAmountToMax}
          onPercent={vm.setPercent}
          onToggleConfirm={vm.toggleConfirmIrreversible}
          onSubmit={vm.authorize}
        />
      )}

      {vm.phase === 'sent' && (
        <span className={styles.sent} role="status">
          {WITHDRAW_COPY.sent}
        </span>
      )}
    </div>
  )
}
