/** The `?view=` query param the left rail writes and the lobby reads. */
export const LOBBY_VIEW_PARAM = 'view'

/** Every legal `?view=` value. Doubles as the runtime allowlist `parseLobbyView`
 *  validates against — keep in sync with the `LobbyView` union. */
export const LOBBY_VIEWS = ['favorites', 'recent', 'hot', 'new', 'all'] as const

/** The view a missing or unrecognised `?view=` falls back to: the full lobby. */
export const DEFAULT_LOBBY_VIEW = 'all'

/** Cards in the "Hot Markets" row — the top N by 24h notional volume. */
export const HOT_MARKET_LIMIT = 12

/** Cards in the "New Listings" row — the newest N by the venue's native listing
 *  order (see `build-lobby-sections.ts` for why this is a proxy). */
export const NEW_LISTINGS_LIMIT = 12
