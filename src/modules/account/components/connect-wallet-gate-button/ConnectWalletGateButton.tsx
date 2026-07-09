import { useIsWalletConnected } from '../use-is-wallet-connected'
import type { ConnectWalletGateButtonProps } from './connect-wallet-gate-button.types'

/**
 * Wallet-gate mode-3 (see `wallet-gate.md`). When the wallet is connected,
 * renders the wrapped submit affordance unchanged; when disconnected, renders
 * nothing — the connect entry point lives in the header `Connect Wallet`
 * button (and `AccountAvatarTrigger`) in `AppShell`, so the gated affordance
 * is simply absent rather than swapped for a CTA.
 */
export function ConnectWalletGateButton({ children }: ConnectWalletGateButtonProps) {
  const isConnected = useIsWalletConnected()

  if (!isConnected) return null

  return <>{children}</>
}
