import { ConnectWalletGateButton } from '@/modules/account'
import { PixelButton } from '../pixel-button'
import { useDepositTrigger } from './use-deposit-trigger'
import type { DepositTriggerProps } from './deposit-trigger.types'

/**
 * Capability-gated "Deposit" entry point. Renders only when `canDeposit` — the
 * active venue exposes an in-app `deposit` capability AND the app is not
 * spectating (otherwise `null`, so no broken or wrong-account affordance
 * appears). Wallet-gated via `<ConnectWalletGateButton>` (mode-3 of
 * `wallet-gate.md`): disconnected → nothing (the affordance is absent; connect
 * lives in the header `AccountMenu`); connected → an `elevated` "Deposit"
 * `PixelButton` that opens the shared deposit sheet. Shared because three entry
 * points (account dock, portfolio, onboarding) reuse it.
 */
export function DepositTrigger({
  variant = 'accentFilled',
  size,
  fullWidth,
}: DepositTriggerProps) {
  const { canDeposit, onClick } = useDepositTrigger()

  if (!canDeposit) return null

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
        Deposit
      </PixelButton>
    </ConnectWalletGateButton>
  )
}
