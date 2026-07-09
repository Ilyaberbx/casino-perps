import type { Market } from '@/modules/shared/domain/domain.types'
import {
  resolveMarketIconUrl,
  resolveSpotBareIconUrl,
} from '@/modules/shared/utils/resolve-market-icon-url'
import { matchesSymbolOrBaseAsset } from '@/modules/shared/utils/match-by-symbol-or-base-asset'
import { getMarketCategory } from '../../trading.utils'
import type { MarketCategoryTab } from '../../trading.types'
import type { CategoryPill } from './market-selection-window.types'
import { POPULAR_ORDER } from './market-selection-window.constants'

/**
 * Filters a market list by the active asset-class tab (Minara 1:1 — ADR-0062).
 * 'all' returns every market unchanged (guard clause); otherwise the market's
 * category — derived from its base asset via `getMarketCategory` — must equal the
 * tab. Spot and HIP-3 markets fold into their category (mostly crypto / stocks),
 * so nothing is dropped by the tab choice itself.
 */
export function filterByCategory(markets: Market[], tab: MarketCategoryTab): Market[] {
  if (tab === 'all') return markets
  return markets.filter((m) => getMarketCategory(m.baseAsset) === tab)
}

/**
 * Filters markets by a case-insensitive substring search over symbol and baseAsset
 * via the shared `matchesSymbolOrBaseAsset` predicate.
 * Empty query returns all markets unchanged.
 * Per SEL-04: filtering happens after tab filter and before pill sort.
 */
export function filterBySearch(markets: Market[], query: string): Market[] {
  const isEmptyQuery = query.length === 0
  if (isEmptyQuery) return markets
  const lower = query.toLowerCase()
  return markets.filter((m) => matchesSymbolOrBaseAsset(m, lower))
}

/**
 * Sorts a market list according to the active category pill.
 * Always returns a new array (never mutates input).
 *
 * 'popular': sort by POPULAR_ORDER index; markets unlisted in the curated set
 *            (all of SPOT — POPULAR_ORDER is perp-only) tie-break by
 *            descending volume24h so Popular = most liquid there (ADR-0017).
 * 'hot':     descending volume24h (nulls treated as 0).
 * 'gainers': descending change24hPct (nulls treated as 0).
 * 'losers':  ascending change24hPct (nulls treated as 0; most negative first).
 */
export function sortByPill(markets: Market[], pill: CategoryPill): Market[] {
  if (pill === 'popular') {
    return [...markets].sort((a, b) => {
      const aIndex = POPULAR_ORDER.indexOf(a.symbol)
      const bIndex = POPULAR_ORDER.indexOf(b.symbol)
      const aRank = aIndex === -1 ? POPULAR_ORDER.length : aIndex
      const bRank = bIndex === -1 ? POPULAR_ORDER.length : bIndex
      const isSameRank = aRank === bRank
      if (isSameRank) return (b.volume24h ?? 0) - (a.volume24h ?? 0)
      return aRank - bRank
    })
  }
  if (pill === 'hot') {
    return [...markets].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
  }
  if (pill === 'gainers') {
    return [...markets].sort((a, b) => (b.change24hPct ?? 0) - (a.change24hPct ?? 0))
  }
  // 'losers': ascending (most negative change first)
  return [...markets].sort((a, b) => (a.change24hPct ?? 0) - (b.change24hPct ?? 0))
}

/**
 * Collects the de-duplicated icon URLs worth warming for a market list, SPOT
 * FIRST. Spot composite icons (`{BASE}_{QUOTE}.svg`, 10–150 KB) are the only
 * ones large enough to flicker on a virtualized remount, so they must lead the
 * idle warm queue; perp/hip3 (tiny/local) follow as a cheap completeness bonus.
 * Each spot market also contributes its bare `{BASE}.svg` fallback. Reuses the
 * shared URL resolvers so URL shapes stay single-sourced. 'placeholder'
 * resolutions contribute nothing.
 */
export function collectIconWarmUrls(markets: ReadonlyArray<Market>): string[] {
  const urls = new Set<string>()

  const addMarketUrls = (market: Market): void => {
    const resolution = resolveMarketIconUrl(market)
    if (resolution.kind !== 'placeholder') urls.add(resolution.url)
    const bareUrl = resolveSpotBareIconUrl(market)
    if (bareUrl !== null) urls.add(bareUrl)
  }

  const isSpotMarket = (market: Market): boolean => (market.marketType ?? 'perp') === 'spot'

  for (const market of markets) {
    if (isSpotMarket(market)) addMarketUrls(market)
  }
  for (const market of markets) {
    if (!isSpotMarket(market)) addMarketUrls(market)
  }

  return [...urls]
}
