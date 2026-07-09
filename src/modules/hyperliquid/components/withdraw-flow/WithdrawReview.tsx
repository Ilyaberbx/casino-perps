import { CopyableAddress } from '@/modules/shared/components/copyable-address'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './withdraw-flow.module.css'
import { WITHDRAW_ARRIVAL_LABEL, WITHDRAW_COPY } from './withdraw-flow.constants'
import type { WithdrawReviewProps } from './withdraw-flow.types'

/**
 * The `review` step: a read-only confirmation of amount, destination (via
 * `CopyableAddress`), fee, net received, and arrival window. Back returns to the
 * form; "Sign withdrawal" signs the `withdraw3` action (busy while signing).
 */
export function WithdrawReview(props: WithdrawReviewProps) {
  const signLabel = props.isSigning ? WITHDRAW_COPY.signingCta : WITHDRAW_COPY.signCta

  return (
    <div className={styles.track}>
      <div className={styles.reviewRows}>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{WITHDRAW_COPY.amountRowLabel}</span>
          <span className={styles.reviewValue}>{props.amount} USDC</span>
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{WITHDRAW_COPY.destinationRowLabel}</span>
          <CopyableAddress address={props.destination} align="start" />
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{WITHDRAW_COPY.feeLabel}</span>
          <span className={styles.reviewValue}>${props.fee.toFixed(2)}</span>
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{WITHDRAW_COPY.receiveLabel}</span>
          <span className={styles.reviewValue}>≈{props.netReceived} USDC</span>
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{WITHDRAW_COPY.arrivalLabel}</span>
          <span className={styles.reviewValue}>{WITHDRAW_ARRIVAL_LABEL}</span>
        </div>
      </div>
      <div className={styles.actions}>
        <PixelButton
          variant="default"
          className={styles.action}
          disabled={props.isSigning}
          onClick={props.onBack}
        >
          {WITHDRAW_COPY.backCta}
        </PixelButton>
        <PixelButton
          variant="accentFilled"
          className={styles.action}
          disabled={props.isSigning}
          aria-busy={props.isSigning}
          onClick={props.onSign}
        >
          {signLabel}
        </PixelButton>
      </div>
    </div>
  )
}
