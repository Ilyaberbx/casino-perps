import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './deposit-flow.module.css'
import { DEPOSIT_COPY } from './deposit-flow.constants'

/**
 * `wrong-chain` track: a single "Switch to Arbitrum" affordance. The sheet
 * never shows the deposit button on the wrong chain (D-3 hard-gate) — it offers
 * the switch and re-resolves on success. A rejected switch returns here
 * non-destructively.
 */
export function WrongChainTrack({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className={styles.track}>
      <PixelButton variant="accentFilled" fullWidth onClick={onSwitch}>
        {DEPOSIT_COPY.switchChainCta}
      </PixelButton>
    </div>
  )
}
