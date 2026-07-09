import { CopyableAddress } from '@/modules/shared/components/copyable-address'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './send-flow.module.css'
import { SEND_COPY } from './send-flow.constants'
import type { SendReviewProps } from './send-flow.types'

/**
 * The `review` step: a read-only confirmation of amount + token, recipient (via
 * `CopyableAddress`), and the stays-on-Hyperliquid note. Back returns to the
 * form; "Sign send" signs the routed `usdSend` / `spotSend` action (busy while
 * signing).
 */
export function SendReview(props: SendReviewProps) {
  const signLabel = props.isSigning ? SEND_COPY.signingCta : SEND_COPY.signCta

  return (
    <div className={styles.track}>
      <div className={styles.reviewRows}>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{SEND_COPY.amountRowLabel}</span>
          <span className={styles.reviewValue}>
            {props.amount} {props.symbol}
          </span>
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{SEND_COPY.toRowLabel}</span>
          <CopyableAddress address={props.destination} align="start" />
        </div>
        <p className={styles.summaryNote}>{SEND_COPY.internalNote}</p>
      </div>
      <div className={styles.actions}>
        <PixelButton
          variant="default"
          className={styles.action}
          disabled={props.isSigning}
          onClick={props.onBack}
        >
          {SEND_COPY.backCta}
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
