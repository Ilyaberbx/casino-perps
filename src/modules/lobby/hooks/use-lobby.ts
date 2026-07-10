import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import type { Market } from '@/modules/shared/domain'
import { buildLobbySections } from '../utils/build-lobby-sections'
import { HOT_MARKET_LIMIT, NEW_LISTINGS_LIMIT } from '../lobby.constants'
import type { LobbySection } from '../lobby.types'

const NO_MARKETS: ReadonlyArray<Market> = []

export interface UseLobbyResult {
  /** True until the venue's first market snapshot lands. Drives skeletons. */
  isLoading: boolean
  /** The three carousel rows, fully resolved (title + markets). Empty until loaded. */
  sections: ReadonlyArray<LobbySection>
}

/**
 * Smart hook for the lobby page. Reads the venue market universe through the
 * `marketData` capability port (never importing a venue module directly) with
 * the same `useSyncExternalStore` wiring the hot-markets ticker uses, and
 * partitions it into the Hot / New / All carousels. Card→route navigation is a
 * plain `<Link>` in the dumb carousel (`tradeHref`), so it stays out of here.
 *
 * `useVenueOptional` (not `useVenue`) so the lobby renders a clean loading state
 * under test harnesses and any pre-venue paint instead of throwing.
 */
export function useLobby(): UseLobbyResult {
  const venue = useVenueOptional()
  const marketDataCap = venue?.capabilities.marketData ?? null

  const subscribeMarkets = useCallback(
    (onChange: () => void) => {
      if (marketDataCap === null) return () => {}
      return marketDataCap.subscribeMarkets(onChange)
    },
    [marketDataCap],
  )
  const getMarkets = useCallback(
    () => (marketDataCap === null ? NO_MARKETS : marketDataCap.listMarkets()),
    [marketDataCap],
  )
  const markets = useSyncExternalStore(subscribeMarkets, getMarkets)

  const isLoading = markets.length === 0

  const sections = useMemo<LobbySection[]>(() => {
    const { hot, newListings, all } = buildLobbySections(
      markets,
      HOT_MARKET_LIMIT,
      NEW_LISTINGS_LIMIT,
    )
    return [
      { id: 'hot', title: 'Hot Markets', markets: hot },
      { id: 'new', title: 'New Listings', markets: newListings },
      { id: 'all', title: 'All Markets', markets: all },
    ]
  }, [markets])

  return { isLoading, sections }
}
