import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './send-flow.module.css'
import { SEND_COPY } from './send-flow.constants'
import type { SendSuccessProps } from './send-flow.types'

/**
 * The `sent` confirmation. A send is an HL-internal transfer (usdSend /
 * spotSend) — no L1 bridge, no settlement lag — so unlike the withdraw arrival
 * track there is no pending row: an instant ✓ "Sent {amount} {symbol}" and a
 * "Done" button that resets + closes.
 */
export function SendSuccess({ amount, symbol, onDone }: SendSuccessProps) {
  return (
    <div className={styles.track}>
      <div className={styles.success}>
        <span className={styles.successIcon} aria-hidden="true">
          ✓
        </span>
        <span className={styles.successLabel}>
          {SEND_COPY.sentLabelPrefix} {amount} {symbol}
        </span>
        <p className={styles.successNote}>{SEND_COPY.internalNote}</p>
      </div>
      <PixelButton variant="accentFilled" fullWidth onClick={onDone}>
        {SEND_COPY.doneCta}
      </PixelButton>
    </div>
  )
}
