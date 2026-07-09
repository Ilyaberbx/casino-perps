import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './evm-core-flow.module.css'
import {
  EVM_CORE_COPY,
  EVM_CORE_INTERNAL_NOTE,
  EVM_CORE_MOVED_SUFFIX,
} from './evm-core-flow.constants'
import type { EvmCoreSuccessProps } from './evm-core-flow.types'

/**
 * The `sent` confirmation. Both directions resolve to an instant ✓ "Moved
 * {amount} {symbol} {to HyperEVM | to HyperCore}". EVM→Core additionally carries
 * an explorer link to the mined HyperEVM tx; Core→EVM has no on-chain tx, so the
 * link is omitted. "Done" resets the flow.
 */
export function EvmCoreSuccess({
  direction,
  amount,
  symbol,
  explorerTxUrl,
  onDone,
}: EvmCoreSuccessProps) {
  return (
    <div className={styles.track}>
      <div className={styles.success}>
        <span className={styles.successIcon} aria-hidden="true">
          ✓
        </span>
        <span className={styles.successLabel}>
          {EVM_CORE_COPY.movedLabelPrefix} {amount} {symbol} {EVM_CORE_MOVED_SUFFIX[direction]}
        </span>
        <p className={styles.successNote}>{EVM_CORE_INTERNAL_NOTE[direction]}</p>
        {explorerTxUrl !== null && (
          <a
            className={styles.txLink}
            href={explorerTxUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            {EVM_CORE_COPY.viewTxCta}
          </a>
        )}
      </div>
      <PixelButton variant="accentFilled" fullWidth onClick={onDone}>
        {EVM_CORE_COPY.doneCta}
      </PixelButton>
    </div>
  )
}
