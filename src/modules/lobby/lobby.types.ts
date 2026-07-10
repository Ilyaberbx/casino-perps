import type { Market } from '@/modules/shared/domain'

/** Stable identity for a lobby carousel section. Drives the section icon and is
 *  the React key for the rendered row. */
export type LobbySectionId = 'hot' | 'new' | 'all'

/** One carousel row: a titled, icon-prefixed horizontal strip of markets. The
 *  hook produces these fully resolved; the components stay dumb. */
export interface LobbySection {
  id: LobbySectionId
  title: string
  markets: Market[]
}

/** The three market buckets the pure section builder produces from the venue
 *  universe. `newListings` is a listing-order proxy, not a dated field — see
 *  `build-lobby-sections.ts` and MODULE.md "New Listings is a proxy". */
export interface LobbyBuckets {
  hot: Market[]
  newListings: Market[]
  all: Market[]
}
