import { ConnectWalletGateButton } from '@/modules/account'
import { PixelButton } from '../pixel-button'
import { useTransferTrigger } from './use-transfer-trigger'
import type { TransferTriggerProps } from './transfer-trigger.types'

/**
 * Capability-gated "Transfer" entry point. Renders only when the active venue
 * exposes an in-app `transfer` capability, the account is segregated, AND the
 * app is not spectating (otherwise `null`, so no broken or wrong-account
 * affordance appears — unified accounts, venues without transfer, and spectate
 * sessions show nothing). Wallet-gated via
 * `<ConnectWalletGateButton>` (mode-3 of `wallet-gate.md`): disconnected →
 * nothing (connect lives in the header `AccountMenu`); connected → a "Transfer"
 * `PixelButton` that opens the shared transfer sheet with the default direction
 * (Spot→Perp, no prefill). Mirrors `DepositTrigger`.
 */
export function TransferTrigger({
  variant = 'default',
  size,
  fullWidth,
}: TransferTriggerProps) {
  const { isTransferAvailable, onClick } = useTransferTrigger()

  if (!isTransferAvailable) return null

  return (
    <ConnectWalletGateButton>
      <PixelButton
        type="button"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        elevated
        onClick={onClick}
      >
        Transfer
      </PixelButton>
    </ConnectWalletGateButton>
  )
}
