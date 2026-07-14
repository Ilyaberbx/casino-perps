import { LOBBY_VIEWS, LOBBY_VIEW_PARAM, DEFAULT_LOBBY_VIEW } from '../lobby.constants'
import type { LobbyView } from '../lobby.types'

/**
 * The only thing that turns a URL into a `LobbyView`. Reads `?view=` out of a
 * `location.search` string and falls back to `all` for **both** a missing param
 * and an unrecognised one (`?view=bogus`), so a hand-typed URL always lands on
 * the full lobby with the "All Markets" rail item highlighted rather than on a
 * blank screen with nothing highlighted.
 *
 * Pure — the rail (`use-left-rail`) and the lobby (`use-lobby`) both call it, so
 * they can never disagree about what the current view is.
 */
export function parseLobbyView(search: string): LobbyView {
  const raw = new URLSearchParams(search).get(LOBBY_VIEW_PARAM)
  const isKnownView = raw !== null && (LOBBY_VIEWS as ReadonlyArray<string>).includes(raw)
  return isKnownView ? (raw as LobbyView) : DEFAULT_LOBBY_VIEW
}
