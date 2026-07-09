import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './deposit-flow.module.css'
import { DEPOSIT_COPY } from './deposit-flow.constants'
import type { SuccessTrackProps } from './deposit-flow.types'

/**
 * `sent` / `credited` track: the two distinct, legible money-in-motion moments.
 * Row 1 ("Sent from wallet") is always ✓ here (we only reach this track after
 * the Arbitrum receipt). Row 2 is a pending spinner ("Crediting…") until the
 * live account-value reader rises, then flips to ✓ ("Funds available"). The
 * "Start trading" button appears only once credited. No confetti — a crisp ✓.
 */
export function SuccessTrack({ isCredited, onDone }: SuccessTrackProps) {
  return (
    <div className={styles.track}>
      <div className={styles.stepRows}>
        <div className={styles.stepRow}>
          <span className={styles.stepIconDone} aria-hidden="true">
            ✓
          </span>
          <span>{DEPOSIT_COPY.sentLabel}</span>
        </div>
        <div className={styles.stepRow}>
          {isCredited ? (
            <span className={styles.stepIconDone} aria-hidden="true">
              ✓
            </span>
          ) : (
            <span className={styles.spinner} aria-hidden="true" />
          )}
          <span>{isCredited ? DEPOSIT_COPY.creditedLabel : DEPOSIT_COPY.creditingLabel}</span>
        </div>
      </div>
      {isCredited && (
        <PixelButton variant="accentFilled" fullWidth onClick={onDone}>
          {DEPOSIT_COPY.doneCta}
        </PixelButton>
      )}
    </div>
  )
}
