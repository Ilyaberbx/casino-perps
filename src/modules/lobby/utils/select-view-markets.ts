import type { Market } from '@/modules/shared/domain'

/**
 * Favorites ∩ the live universe, in **universe order**.
 *
 * Not insertion order: the favorites `Set` does preserve it, but that order is
 * meaningless after a `reconcileFavorites` pass or the bare-`string[]` legacy
 * migration, and nothing surfaces it today. Universe order is stable, matches
 * the "All Markets" row, and never reshuffles under the user. Recency is
 * `Recent`'s job, not Favorites'.
 *
 * Intersecting here means a delisted favorite silently drops out of the view.
 */
export function selectFavoriteMarkets(
  markets: ReadonlyArray<Market>,
  favoriteSymbols: ReadonlySet<string>,
): ReadonlyArray<Market> {
  return markets.filter((market) => favoriteSymbols.has(market.symbol))
}

/**
 * Recent ∩ the live universe, in **recency order** (most-recent first).
 *
 * Driven off `recentSymbols`, not off `markets`, precisely because the order
 * comes from the stored list. Symbols the venue no longer lists are dropped —
 * this read-time intersection is why the write path never needs to reconcile
 * against delistings (see `recordRecentMarket`).
 */
export function orderRecentMarkets(
  markets: ReadonlyArray<Market>,
  recentSymbols: ReadonlyArray<string>,
): ReadonlyArray<Market> {
  const bySymbol = new Map(markets.map((market) => [market.symbol, market]))
  return recentSymbols
    .map((symbol) => bySymbol.get(symbol))
    .filter((market): market is Market => market !== undefined)
}
