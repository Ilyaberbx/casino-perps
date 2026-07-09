export const SPECTATE_QUERY_PARAM = 'spectate'

export const WATCHLIST_STORAGE_KEY = 'spectate.watchlist.v1'

// Shown when a disconnected user tries to spectate (launcher trigger, a direct
// startSpectating call, or a `?spectate=` URL opened cold). Spectating requires
// a connected wallet — see the provider gating and `wallet-gate.md`.
export const SPECTATE_CONNECT_WALLET_MESSAGE = 'Connect wallet first'
