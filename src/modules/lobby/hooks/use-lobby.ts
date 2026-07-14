import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { useFavoritesOptional, useRecentMarketsOptional } from '@/modules/trading'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import type { Market } from '@/modules/shared/domain'
import { buildLobbySections } from '../utils/build-lobby-sections'
import { parseLobbyView } from '../utils/parse-lobby-view'
import { selectFavoriteMarkets, orderRecentMarkets } from '../utils/select-view-markets'
import { HOT_MARKET_LIMIT, NEW_LISTINGS_LIMIT } from '../lobby.constants'
import type { LobbyContent, UseLobbyResult } from '../lobby.types'

const NO_MARKETS: ReadonlyArray<Market> = []
const NO_SYMBOLS: ReadonlySet<string> = new Set()
const NO_RECENT: ReadonlyArray<string> = []

/**
 * Smart hook for the lobby page. Reads the venue market universe through the
 * `marketData` capability port (never importing a venue module directly) with
 * the same `useSyncExternalStore` wiring the hot-markets ticker uses, then
 * shapes it according to the `?view=` param the left rail writes.
 *
 * - `all` (and a missing or unrecognised param) → the Hot / New / All carousels.
 * - `hot` / `new` → the **same** `buildLobbySections` buckets, rendered as a grid.
 *   There is deliberately no separate focused-view limit: one section policy,
 *   one place. Bump `HOT_MARKET_LIMIT` / `NEW_LISTINGS_LIMIT` and both surfaces
 *   move together.
 * - `favorites` / `recent` → the persisted symbol lists intersected with the live
 *   universe (see `select-view-markets`).
 *
 * Card→route navigation is a plain `<Link>` in the dumb child (`tradeHref`), so
 * it stays out of here.
 *
 * `useVenueOptional` / `useFavoritesOptional` / `useRecentMarketsOptional` (not
 * their throwing siblings) so the lobby renders a clean loading state under test
 * harnesses and any pre-provider paint instead of crashing.
 */
export function useLobby(): UseLobbyResult {
  const { search } = useLocation()
  const view = parseLobbyView(search)

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

  const favoriteSymbols = useFavoritesOptional()?.favoriteSymbols ?? NO_SYMBOLS
  const recentSymbols = useRecentMarketsOptional()?.recentSymbols ?? NO_RECENT

  const isLoading = markets.length === 0

  const buckets = useMemo(
    () => buildLobbySections(markets, HOT_MARKET_LIMIT, NEW_LISTINGS_LIMIT),
    [markets],
  )

  const content = useMemo<LobbyContent>(() => {
    if (view === 'hot') return { kind: 'focused', view, markets: buckets.hot }
    if (view === 'new') return { kind: 'focused', view, markets: buckets.newListings }
    if (view === 'favorites') {
      return { kind: 'focused', view, markets: selectFavoriteMarkets(markets, favoriteSymbols) }
    }
    if (view === 'recent') {
      return { kind: 'focused', view, markets: orderRecentMarkets(markets, recentSymbols) }
    }
    return {
      kind: 'carousels',
      sections: [
        { id: 'hot', title: 'Hot Markets', markets: buckets.hot },
        { id: 'new', title: 'New Listings', markets: buckets.newListings },
        { id: 'all', title: 'All Markets', markets: buckets.all },
      ],
    }
  }, [view, buckets, markets, favoriteSymbols, recentSymbols])

  return { isLoading, view, content }
}
