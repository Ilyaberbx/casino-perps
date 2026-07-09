import { Callout } from '@/modules/shared/components/callout'
import { PixelButton } from '@/modules/shared/components/pixel-button'
import styles from './evm-core-flow.module.css'
import { EVM_CORE_COPY } from './evm-core-flow.constants'
import type { EvmCorePreflightNoticeProps } from './evm-core-flow.types'

/**
 * The EVM→Core preflight gate. Shown instead of the amount form until the EVM
 * side is `ready`: `checking` (reading chain/gas/balance), `wrong-chain` (offer a
 * switch to HyperEVM), or `no-gas` (block — the wallet holds no HYPE for gas).
 * Renders nothing once ready (the form takes over).
 */
export function EvmCorePreflightNotice({ status, onSwitchChain }: EvmCorePreflightNoticeProps) {
  if (status === 'ready') return null

  if (status === 'checking') {
    return (
      <p className={styles.availableLine} role="status">
        {EVM_CORE_COPY.checkingNote}
      </p>
    )
  }

  if (status === 'wrong-chain') {
    return (
      <div className={styles.track}>
        <PixelButton variant="accentFilled" fullWidth onClick={onSwitchChain}>
          {EVM_CORE_COPY.switchChainCta}
        </PixelButton>
      </div>
    )
  }

  return (
    <Callout variant="error" label={EVM_CORE_COPY.noGasHeadline}>
      {EVM_CORE_COPY.noGasBody}
    </Callout>
  )
}
