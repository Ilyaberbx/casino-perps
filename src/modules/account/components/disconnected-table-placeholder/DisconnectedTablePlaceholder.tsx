import { useIsWalletConnected } from '../use-is-wallet-connected'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import type { DisconnectedTablePlaceholderProps } from './disconnected-table-placeholder.types'

// Wallet gate for list/table panels (mode 2, see wallet-gate.md). The disconnected
// state shares the canonical `PlaceholderMessage` look so a tab reads identically
// whether it's gated (disconnected) or empty — one placeholder vocabulary, themed
// via tokens. The gate predicate (ADR-0004) stays in this account-owned wrapper.
export function DisconnectedTablePlaceholder({
  message,
  children,
}: DisconnectedTablePlaceholderProps) {
  const isConnected = useIsWalletConnected()

  if (isConnected) return <>{children}</>

  return <PlaceholderMessage message={message} />
}
