import { AmountInput } from '@/modules/shared/components/amount-input'
import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './deposit-flow.module.css'
import { DEPOSIT_COPY } from './deposit-flow.constants'
import type { ReadyTrackProps } from './deposit-flow.types'

/**
 * `ready` / `no-gas` / `signing` track: the amount surface. An `AmountInput`
 * (default-full balance, min-5, max-balance) + the primary "Deposit to
 * Hyperliquid" button. `no-gas` shows a soft advisory `Callout` but keeps the
 * button enabled (the user may have a gas sponsor). `signing` busies the button.
 */
export function ReadyTrack({
  amount,
  isAmountValid,
  amountInvalidReason,
  showGasWarning,
  isSigning,
  onAmountChange,
  onMax,
  onSubmit,
}: ReadyTrackProps) {
  const ctaLabel = isSigning ? DEPOSIT_COPY.signingCta : DEPOSIT_COPY.depositCta
  const isSubmitDisabled = isSigning || !isAmountValid

  return (
    <div className={styles.track}>
      {showGasWarning && (
        <Callout variant="info" label={DEPOSIT_COPY.noGasLabel}>
          {DEPOSIT_COPY.noGasProse}
        </Callout>
      )}
      <AmountInput
        label={DEPOSIT_COPY.amountLabel}
        value={amount}
        onChange={onAmountChange}
        isValid={isAmountValid}
        invalidReason={amountInvalidReason ?? undefined}
        unit="USDC"
        disabled={isSigning}
        onMax={onMax}
      />
      <PixelButton
        variant="accentFilled"
        fullWidth
        disabled={isSubmitDisabled}
        aria-busy={isSigning}
        onClick={onSubmit}
      >
        {ctaLabel}
      </PixelButton>
    </div>
  )
}
