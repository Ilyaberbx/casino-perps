import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './withdraw-flow.module.css'
import { WITHDRAW_ARRIVAL_LABEL, WITHDRAW_COPY } from './withdraw-flow.constants'
import type { WithdrawArrivalTrackProps } from './withdraw-flow.types'

/**
 * The `sent` track: the money-in-motion arrival moment (mirrors the deposit
 * SuccessTrack). Row 1 ("Withdrawal signed") is always ✓ here (we only reach
 * this track after `status:ok`). Row 2 is a pending spinner ("Arriving on
 * Arbitrum (~5 min)") — the L1 bridge settles asynchronously, so the row stays
 * pending; we surface the estimate rather than poll. "Done" dismisses + resets.
 */
export function WithdrawArrivalTrack({ onDone }: WithdrawArrivalTrackProps) {
  return (
    <div className={styles.track}>
      <div className={styles.stepRows}>
        <div className={styles.stepRow}>
          <span className={styles.stepIconDone} aria-hidden="true">
            ✓
          </span>
          <span>{WITHDRAW_COPY.signedLabel}</span>
        </div>
        <div className={styles.stepRow}>
          <span className={styles.spinner} aria-hidden="true" />
          <span>
            {WITHDRAW_COPY.arrivingLabel} ({WITHDRAW_ARRIVAL_LABEL})
          </span>
        </div>
      </div>
      <PixelButton variant="accentFilled" fullWidth onClick={onDone}>
        {WITHDRAW_COPY.doneCta}
      </PixelButton>
    </div>
  )
}
