import { AmountInput } from '@/modules/shared/components/amount-input'
import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { PixelCheckbox } from '@/modules/shared/components/pixel-checkbox'
import { FlowPercentChips } from '@/modules/shared/components/flow-percent-chips'
import { RecipientCombobox } from '@/modules/shared/components/recipient-combobox'
import styles from './withdraw-flow.module.css'
import {
  WITHDRAW_ARRIVAL_LABEL,
  WITHDRAW_COPY,
  WITHDRAW_PERCENT_CHIPS,
} from './withdraw-flow.constants'
import type { WithdrawFormProps } from './withdraw-flow.types'

/**
 * The `form` step: amount input (capped at the withdrawable) + percent chips, an
 * "available to withdraw" line, the destination combobox (prefilled to the user's
 * own wallet, with your-wallets + recent suggestions), an irreversible warning +
 * confirm gate once the address is edited, a fee/min/net/arrival summary, and the
 * primary "Review withdrawal" CTA.
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
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.feeLabel}</span>
          <span className={styles.summaryValue}>${props.fee.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.minLabel}</span>
          <span className={styles.summaryValue}>${props.minWithdraw.toFixed(2)}</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.receiveLabel}</span>
          <span className={styles.summaryValue}>≈{props.netReceived} USDC</span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{WITHDRAW_COPY.arrivalLabel}</span>
          <span className={styles.summaryValue}>{WITHDRAW_ARRIVAL_LABEL}</span>
        </div>
      </div>

      <PixelButton
        variant="accentFilled"
        fullWidth
        disabled={!props.canReview}
        onClick={props.onReview}
      >
        {WITHDRAW_COPY.reviewCta}
      </PixelButton>
    </div>
  )
}
