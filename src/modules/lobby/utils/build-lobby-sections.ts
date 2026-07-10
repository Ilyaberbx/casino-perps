import type { Market } from '@/modules/shared/domain'
import type { LobbyBuckets } from '../lobby.types'

/**
 * Partition the venue market universe into the lobby's three carousel buckets.
 * Pure — no React, no I/O, no module state — so the paging/section logic is
 * unit-testable in isolation.
 *
 * - **Hot** = the top `hotLimit` markets by 24h notional volume (`volume24h`),
 *   descending. Markets missing a volume sort as 0.
 * - **New Listings** = a **proxy**, not a dated field. The domain `Market` has
 *   no `listedAt` / `createdAt`, so there is nothing to sort "new" by. The
 *   venue's `listMarkets()` returns perps in Hyperliquid **universe-append
 *   order** (a newly listed asset is appended to the tail of the universe), so
 *   the *tail* of the native order is the closest defensible "newest" signal.
 *   We take the last `newLimit` markets of the native order that are **not**
 *   already surfaced as Hot. This is deliberately labelled a listing-order
 *   proxy — it is never volume-sorted data relabelled as "new". See MODULE.md.
 * - **All Markets** = every market not surfaced in Hot or New, in native order.
 *
 * The three buckets are disjoint: a market appears in exactly one row.
 */
export function buildLobbySections(
  markets: ReadonlyArray<Market>,
  hotLimit: number,
  newLimit: number,
): LobbyBuckets {
  const byVolumeDesc = [...markets].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
  const hot = byVolumeDesc.slice(0, hotLimit)

  const hotSymbols = new Set(hot.map((m) => m.symbol))
  const outsideHot = markets.filter((m) => !hotSymbols.has(m.symbol))

  // Tail of the native listing order = newest by universe-append order.
  const newListings = outsideHot.slice(Math.max(0, outsideHot.length - newLimit))

  const newSymbols = new Set(newListings.map((m) => m.symbol))
  const all = outsideHot.filter((m) => !newSymbols.has(m.symbol))

  return { hot, newListings, all }
}
