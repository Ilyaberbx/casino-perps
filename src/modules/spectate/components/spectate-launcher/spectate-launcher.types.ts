import type { WatchlistItem } from '../../providers/spectate-provider'

export type SpectateTab = 'enter' | 'watchlist'

export interface SpectateLauncherProps {
  /**
   * Whether a wallet is connected (the single `useIsWalletConnected()` source of
   * truth, threaded from `AppShell`). Spectating requires a connected wallet;
   * opening the launcher while disconnected shows a "Connect wallet first" toast
   * instead.
   */
  isWalletConnected: boolean
}

export interface SpectateWatchlistRow {
  address: string
  label?: string
  displayAddress: string
  isEditing: boolean
  labelDraft: string
}

export interface SpectateLauncherState {
  isOpen: boolean
  activeTab: SpectateTab
  addressInput: string
  error: string | null
  canSubmit: boolean
  watchlist: readonly WatchlistItem[]
  watchlistRows: readonly SpectateWatchlistRow[]
  onOpen: () => void
  onClose: () => void
  onSelectTab: (tab: SpectateTab) => void
  onAddressChange: (value: string) => void
  onSubmit: () => void
  onSaveToWatchlist: () => void
  onSpectateEntry: (address: string) => void
  onRemoveEntry: (address: string) => void
  onStartEditLabel: (address: string) => void
  onLabelDraftChange: (address: string, value: string) => void
  onCommitLabel: (address: string) => void
}

export interface EnterAddressTabProps {
  addressInput: string
  error: string | null
  canSubmit: boolean
  onAddressChange: (value: string) => void
  onSubmit: () => void
  onSaveToWatchlist: () => void
}

export interface WatchlistTabProps {
  rows: readonly SpectateWatchlistRow[]
  onSpectateEntry: (address: string) => void
  onRemoveEntry: (address: string) => void
  onStartEditLabel: (address: string) => void
  onLabelDraftChange: (address: string, value: string) => void
  onCommitLabel: (address: string) => void
}
