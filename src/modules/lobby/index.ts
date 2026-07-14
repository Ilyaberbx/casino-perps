export { LobbyPage } from './pages/LobbyPage'

// The `?view=` contract. The app shell's left rail both writes these URLs and
// highlights the active item from them, so the vocabulary and its parser are
// public — the rail must not restate the union or re-roll the parsing.
export { parseLobbyView } from './utils/parse-lobby-view'
export { LOBBY_VIEW_PARAM, DEFAULT_LOBBY_VIEW } from './lobby.constants'
export type { LobbyView } from './lobby.types'
