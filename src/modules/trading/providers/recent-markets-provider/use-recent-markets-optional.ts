import { useContext } from 'react'
import { RecentMarketsContext } from './recent-markets-provider.context'
import type { RecentMarketsContextValue } from './recent-markets-provider.types'

/**
 * `useRecentMarkets` for consumers that legitimately render outside the provider.
 * Returns `null` instead of throwing.
 *
 * Two callers depend on this:
 * - `useLobby`, which must not throw under a test harness or a pre-venue paint
 *   (the same reason it reaches for `useVenueOptional`).
 * - `use-selected-market-provider`, the *writer*. `SelectedMarketProvider` is
 *   mounted standalone in its own tests, with no `RecentMarketsProvider` above
 *   it — the optional read keeps recording a no-op there instead of a crash.
 */
export function useRecentMarketsOptional(): RecentMarketsContextValue | null {
  return useContext(RecentMarketsContext)
}
