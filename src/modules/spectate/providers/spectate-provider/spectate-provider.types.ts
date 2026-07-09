import type { ReactNode } from 'react'
import type { WalletAddress } from '@/modules/shared/domain'

export interface WatchlistItem {
  address: WalletAddress
  label?: string
}

export interface SpectateContextValue {
  spectatedAddress: WalletAddress | null
  isSpectating: boolean
  startSpectating: (address: WalletAddress) => void
  stopSpectating: () => void
  watchlist: readonly WatchlistItem[]
  addToWatchlist: (entry: WatchlistItem) => void
  removeFromWatchlist: (address: WalletAddress) => void
  isWatchlisted: (address: WalletAddress) => boolean
}

export interface SpectateProviderProps {
  children: ReactNode
  /**
   * Whether a wallet is connected (the single `useIsWalletConnected()` source of
   * truth, threaded from `app/` so the module stays Privy-free). Spectating
   * requires it: while false, `startSpectating` is a no-op + toast, any present
   * `?spectate=` URL override is stripped, and `spectatedAddress`/`isSpectating`
   * read as inactive. Defaults to `true` for provider-free isolated tests.
   */
  isWalletConnected?: boolean
}
