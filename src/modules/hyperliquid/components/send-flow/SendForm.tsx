import { AmountInput } from '@/modules/shared/components/amount-input'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import { FlowTokenSelect } from '../shared-flow/FlowTokenSelect'
import { FlowPercentChips } from '@/modules/shared/components/flow-percent-chips'
import styles from './send-flow.module.css'
import { SEND_ASSET_STATE_COPY, SEND_COPY, SEND_PERCENT_CHIPS } from './send-flow.constants'
import { RecipientCombobox } from '@/modules/shared/components/recipient-combobox'
import { sendRecipientTail } from './send-flow.utils'
import type { SendFormProps } from './send-flow.types'

/**
 * The `form` step: a token picker, an amount input (capped at the selected
 * token's available) + percent chips, an "Available: N SYMBOL" line, a recipient
 * address field (no prefill — a send goes to an external address), a summary
 * (you send / recipient / stays-on-Hyperliquid note), and the primary "Review
 * send" CTA. Disabled until the form is valid.
 */
export function SendForm(props: SendFormProps) {
  const recipientTail = sendRecipientTail(props.destination, props.isDestinationValid)
  const areAssetsReady = props.assetsStatus === 'ready'

  return (
    <div className={styles.track}>
      <FlowTokenSelect
        styles={styles}
        idPrefix="send"
        label={SEND_COPY.tokenLabel}
        tokens={props.tokens}
        selectedTokenKey={props.selectedTokenKey}
        status={props.assetsStatus}
        stateCopy={SEND_ASSET_STATE_COPY}
        onSelect={props.onSelectToken}
        onRetry={props.onRetryAssets}
      />

      {areAssetsReady && (
        <>
      <AmountInput
        label={SEND_COPY.amountLabel}
        value={props.amount}
        onChange={props.onAmountChange}
        isValid={props.isAmountValid}
        invalidReason={props.amountInvalidReason ?? undefined}
        unit={props.symbol}
        onMax={props.onMax}
      />
      <FlowPercentChips
        styles={styles}
        chips={SEND_PERCENT_CHIPS}
        disabled={false}
        onPercent={props.onPercent}
      />
      <p className={styles.availableLine}>
        {SEND_COPY.availablePrefix}{' '}
        <span className={styles.availableValue}>
          {props.available} {props.symbol}
        </span>
      </p>

      <RecipientCombobox {...props.recipient} />

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{SEND_COPY.youSendLabel}</span>
          <span className={styles.summaryValue}>
            {props.amount === '' ? '—' : props.amount} {props.symbol}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.summaryLabel}>{SEND_COPY.recipientRowLabel}</span>
          <span className={styles.summaryValue}>{recipientTail}</span>
        </div>
        <p className={styles.summaryNote}>{SEND_COPY.internalNote}</p>
      </div>

      <PixelButton
        variant="accentFilled"
        fullWidth
        disabled={!props.canReview}
        onClick={props.onReview}
      >
        {SEND_COPY.reviewCta}
      </PixelButton>
        </>
      )}
    </div>
  )
}
