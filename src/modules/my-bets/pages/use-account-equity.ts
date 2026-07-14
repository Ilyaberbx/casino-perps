import { useOwnEquity } from '@/modules/account'

/**
 * The User's own total account equity via `account/`'s shared `useOwnEquity`
 * (Acting-Address-keyed, shows self even while Spectating; disconnected ⇒ `0`).
 * A thin alias so the page and the app-shell balance chip read the same source.
 */
export function useAccountEquity(): { equityUsd: number; isConnected: boolean } {
  const { equityUsd, isConnected } = useOwnEquity()
  return { equityUsd, isConnected }
}
