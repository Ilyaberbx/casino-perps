import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './transfer-flow.module.css'
import { ACCOUNT_LABEL, TRANSFER_COPY } from './transfer-flow.constants'
import type { AccountDirectionProps } from './transfer-flow.types'

/**
 * The From/To account pair with a swap control between them. USDC is the only
 * token (no picker), so the two accounts (Spot / Perps) are the whole direction
 * surface. The swap button flips them.
 */
export function AccountDirection({ from, to, onSwap }: AccountDirectionProps) {
  return (
    <div className={styles.direction}>
      <div className={styles.accountRow}>
        <span className={styles.accountSide}>{TRANSFER_COPY.fromLabel}</span>
        <span className={styles.accountName}>{ACCOUNT_LABEL[from]}</span>
      </div>
      <div className={styles.swapRow}>
        <PixelButton
          type="button"
          variant="default"
          size="sm"
          aria-label={TRANSFER_COPY.swapLabel}
          onClick={onSwap}
        >
          ⇅
        </PixelButton>
      </div>
      <div className={styles.accountRow}>
        <span className={styles.accountSide}>{TRANSFER_COPY.toLabel}</span>
        <span className={styles.accountName}>{ACCOUNT_LABEL[to]}</span>
      </div>
    </div>
  )
}
