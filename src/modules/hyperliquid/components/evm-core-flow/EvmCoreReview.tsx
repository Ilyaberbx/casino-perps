import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './evm-core-flow.module.css'
import {
  EVM_CORE_COPY,
  EVM_CORE_DESTINATION_VALUE,
  EVM_CORE_INTERNAL_NOTE,
} from './evm-core-flow.constants'
import type { EvmCoreReviewProps } from './evm-core-flow.types'

/**
 * The `review` step: a read-only confirmation of amount + token and the
 * destination ("your HyperEVM address" — Core→EVM credits the user's own
 * address, there is no external recipient), plus the credited note. Back returns
 * to the form; "Sign transfer" signs the `spotSend` to the token's system
 * address (busy while signing).
 */
export function EvmCoreReview(props: EvmCoreReviewProps) {
  const signLabel = props.isSigning ? EVM_CORE_COPY.signingCta : EVM_CORE_COPY.signCta

  return (
    <div className={styles.track}>
      <div className={styles.reviewRows}>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{EVM_CORE_COPY.amountRowLabel}</span>
          <span className={styles.reviewValue}>
            {props.amount} {props.symbol}
          </span>
        </div>
        <div className={styles.reviewRow}>
          <span className={styles.reviewLabel}>{EVM_CORE_COPY.destinationRowLabel}</span>
          <span className={styles.reviewValue}>
            {EVM_CORE_DESTINATION_VALUE[props.direction]}
          </span>
        </div>
        <p className={styles.summaryNote}>{EVM_CORE_INTERNAL_NOTE[props.direction]}</p>
      </div>
      <div className={styles.actions}>
        <PixelButton
          variant="default"
          className={styles.action}
          disabled={props.isSigning}
          onClick={props.onBack}
        >
          {EVM_CORE_COPY.backCta}
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
