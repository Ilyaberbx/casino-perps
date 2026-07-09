import { AmountInput } from '@/modules/shared/components/amount-input'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './transfer-flow.module.css'
import { TRANSFER_COPY, TRANSFER_STATUS_ROLE } from './transfer-flow.constants'
import { useTransferFlowBody } from './use-transfer-flow-body'
import { AccountDirection } from './AccountDirection'
import { TransferErrorCallout } from './TransferErrorCallout'

/**
 * The dumb HL transfer body (the `body: FC` the venue exposes via
 * `VenueTransferCapability`). Renders the From/To direction + swap, a fixed-USDC
 * amount input with MAX + an "Available" line, and the submit button. On `error`
 * it swaps in an inline `TransferErrorCallout` + retry (input preserved). The
 * smart `useTransferFlowBody` hook owns all state. `aria-live="polite"` so a
 * screen-reader hears the `signing → error` transitions non-visually.
 */
export function TransferFlow() {
  const { flow } = useTransferFlowBody()

  const isSigning = flow.phase === 'signing'
  const isSubmitDisabled = isSigning || !flow.isAmountValid
  const ctaLabel = isSigning ? TRANSFER_COPY.signingCta : TRANSFER_COPY.transferCta

  return (
    <div className={styles.body} role={TRANSFER_STATUS_ROLE} aria-live="polite">
      <h2 className={styles.title}>{TRANSFER_COPY.title}</h2>
      {flow.phase === 'error' && flow.errorReason !== null ? (
        <TransferErrorCallout reason={flow.errorReason} onRetry={flow.retry} />
      ) : (
        <div className={styles.track}>
          <AccountDirection from={flow.from} to={flow.to} onSwap={flow.swap} />
          <div className={styles.tokenRow}>
            <span>{TRANSFER_COPY.tokenLabel}</span>
          </div>
          <AmountInput
            label={TRANSFER_COPY.amountLabel}
            value={flow.amount}
            onChange={flow.setAmount}
            isValid={flow.isAmountValid}
            invalidReason={flow.amountInvalidReason ?? undefined}
            unit={TRANSFER_COPY.tokenLabel}
            disabled={isSigning}
            onMax={flow.setAmountToMax}
          />
          <p className={styles.availableLine}>
            {TRANSFER_COPY.availablePrefix}{' '}
            <span className={styles.availableValue}>{flow.available} USDC</span>
          </p>
          <PixelButton
            variant="accentFilled"
            fullWidth
            disabled={isSubmitDisabled}
            aria-busy={isSigning}
            onClick={flow.submit}
          >
            {ctaLabel}
          </PixelButton>
        </div>
      )}
    </div>
  )
}
