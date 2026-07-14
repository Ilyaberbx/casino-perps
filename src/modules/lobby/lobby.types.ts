import type { Market } from '@/modules/shared/domain'

/** The `?view=` vocabulary — one value per left-rail lobby item. `all` is the
 *  bare lobby (hero + the three carousels) and is the fallback for a missing or
 *  unrecognised param; every other value is a focused single-grid view.
 *
 *  This is the single source of truth: the rail (`left-rail.types.ts`) imports
 *  it rather than restating the union, and `parseLobbyView` is the only thing
 *  that turns a URL into one. */
export type LobbyView = 'favorites' | 'recent' | 'hot' | 'new' | 'all'

/** The focused views — every `LobbyView` except `all`. These render a single
 *  `MarketGrid` instead of the carousel stack. */
export type FocusedLobbyView = Exclude<LobbyView, 'all'>

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

/** The `all` view: the hero + the three carousel rows. */
export interface LobbyCarouselContent {
  kind: 'carousels'
  sections: ReadonlyArray<LobbySection>
}

/** Any focused view: a single grid of markets. */
export interface LobbyFocusedContent {
  kind: 'focused'
  view: FocusedLobbyView
  markets: ReadonlyArray<Market>
}

/** What the lobby should render, discriminated so the page can't read `sections`
 *  on a focused view (or vice versa). Deliberately carries no icons and no JSX —
 *  the hook stays render-agnostic; the page maps `view` → icon/title/empty copy
 *  via `lobby-page.constants.ts`. */
export type LobbyContent = LobbyCarouselContent | LobbyFocusedContent

export interface UseLobbyResult {
  /** True until the venue's first market snapshot lands. Drives skeletons. */
  isLoading: boolean
  /** The view resolved from `?view=`. `all` for a missing or unrecognised param. */
  view: LobbyView
  content: LobbyContent
}
