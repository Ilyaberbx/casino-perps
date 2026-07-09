import { AmountInput } from '@/modules/shared/components/amount-input'
import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import { FlowPercentChips } from '@/modules/shared/components/flow-percent-chips'
import { ConnectWalletGateButton } from '@/modules/account'
import { RecipientCombobox } from '@/modules/shared/components/recipient-combobox'
import styles from './withdraw-flow.module.css'
import { WITHDRAW_COPY, WITHDRAW_PERCENT_CHIPS } from './withdraw-flow.constants'
import type { WithdrawFormProps } from './withdraw-flow.types'

/**
 * The withdraw form step — kept structurally identical to the Hyperliquid
 * withdraw form: the shared `AmountInput` (with Max) capped at the withdrawable,
 * percent chips, an "available to withdraw" line, the destination combobox (with
 * your-wallets + recent suggestions), an irreversible warning + confirm gate once
 * a destination is entered, a fee-less Min / You-receive summary, and the gated
 * "Authorize withdrawal" CTA. Dumb — all state lives in the parent hook.
 */
export function WithdrawForm(props: WithdrawFormProps) {
  return (
    <div className={styles.track}>
      <AmountInput
        label={WITHDRAW_COPY.amountLabel}
        value={props.amount}
        onChange={props.onAmountChange}
        isValid={props.isAmountValid}
        invalidReason={props.amountInvalidReason ?? undefined}
        unit={WITHDRAW_COPY.tokenLabel}
        onMax={props.onMax}
      />
      <FlowPercentChips
        styles={styles}
        chips={WITHDRAW_PERCENT_CHIPS}
        disabled={false}
        onPercent={props.onPercent}
      />
      <p className={styles.availableLine}>
        {WITHDRAW_COPY.availablePrefix}{' '}
        <span className={styles.availableValue}>{props.withdrawable} USDC</span>
      </p>

      <RecipientCombobox {...props.recipient} />

      {props.isDestinationEdited && (
        <Callout variant="warning" label={WITHDRAW_COPY.irreversibleLabel}>
          {WITHDRAW_COPY.irreversibleProse}
        </Callout>
      )}
      {props.isDestinationEdited && (
        <PixelCheckbox
          checked={props.confirmedIrreversible}
          onChange={props.onToggleConfirm}
          label={WITHDRAW_COPY.confirmLabel}
        />
      )}

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.minLabel}</span>
          <span className={styles.summaryValue}>${props.minWithdraw.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.receiveLabel}</span>
          <span className={styles.summaryValue}>≈{props.netReceived} USDC</span>
        </div>
      </div>

      <ConnectWalletGateButton>
        <PixelButton
          variant="accentFilled"
          fullWidth
          disabled={!props.canSubmit || props.isAuthorizing}
          onClick={props.onSubmit}
        >
          {props.isAuthorizing ? WITHDRAW_COPY.authorizingCta : WITHDRAW_COPY.submitCta}
        </PixelButton>
      </ConnectWalletGateButton>
    </div>
  )
}
