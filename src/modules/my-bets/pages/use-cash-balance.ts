import { useOwnEquity } from '@/modules/account'

/**
 * YOUR CASH — the User's own total account equity via `account/`'s shared
 * `useOwnEquity` (Acting-Address-keyed, shows self even while Spectating;
 * disconnected ⇒ `0`). Kept as a thin alias so the page reads in casino
 * vocabulary ("cash") while the app-shell balance chip reads the same source.
 */
export function useCashBalance(): { cashUsd: number; isConnected: boolean } {
  const { equityUsd, isConnected } = useOwnEquity()
  return { cashUsd: equityUsd, isConnected }
}
