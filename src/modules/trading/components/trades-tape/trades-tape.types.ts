import type { MarketType, Trade } from '../../../shared/domain/domain.types'
import type { WalletAddress } from '../../../shared/domain/wallet-address'
import type { SizeAsset } from '../book-trades-panel/book-trades-panel.types'

export interface UseTradesReturn {
  trades: Trade[]
  /** `true` until the initial trades `snapshot` arrives; drives the tape's loading skeleton. See ADR-0030. */
  isLoading: boolean
  /** Address currently hovered in the tape, or `null` when nothing is hovered. Owned by the tape feature hook. */
  hoveredAddress: WalletAddress | null
  /** Mark an address as hovered so every row sharing it highlights. */
  hoverAddress: (address: WalletAddress) => void
  /** Clear the hovered address. */
  leaveAddress: () => void
  /** One-click spectate the given participant via the spectate module. */
  spectateAddress: (address: WalletAddress) => void
}

export interface TradesTapeProps {
  sizeAsset: SizeAsset
  baseSymbol: string
  quoteSymbol: string
  /**
   * Strips the advanced Taker/Maker participant columns and the TX explorer
   * column, leaving Time/Price/Size only. Used by the mobile Simple-mode combined
   * book+trades panel to keep the tape readable in a short, full-width card.
   */
  compact?: boolean
  /**
   * Whether this tape is the visible panel. Defaults to `true`. When `false` the
   * component renders no body (returns `null`) so its row subtree stops
   * reconciling every animation frame — but the feature hook stays mounted and
   * subscribed, so trades keep accumulating and returning to it shows live state
   * with no skeleton flash. Threaded by `BookTradesPanel` for its inactive tab.
   */
  isActive?: boolean
}

export interface TradeRowProps {
  trade: Trade
  /** Magnitude→decimals spec (`specFromMarket(market)`) for the canonical shared `formatPrice`. */
  priceSpec: { szDecimals: number; marketType: MarketType }
  sizeAsset: SizeAsset
  /** Render the Taker (T) / Maker (M) columns. Set when the venue surfaces participant addresses. */
  showParticipants: boolean
  /** Currently hovered participant address (from the tape feature hook), or `null` when nothing is hovered. Forwarded to each `ParticipantCell` so it can glow when its own address matches. */
  hoveredAddress: WalletAddress | null
  /** Hover handler for a participant cell — broadcasts the hovered address so siblings can glow. */
  onHoverAddress: (address: WalletAddress) => void
  /** Clears the hovered address when the pointer leaves a participant cell. */
  onLeaveAddress: () => void
  /** One-click spectate handler for a participant cell. */
  onSpectateAddress: (address: WalletAddress) => void
  /** Public-explorer URL builder from `Venue.metadata.explorerTxUrl`. Absent when the venue lacks an explorer. */
  explorerTxUrl?: (transactionHash: string) => string
}

export interface ParticipantCellProps {
  /** Which participant this cell renders — used only for the spectate control's accessible label. */
  role: 'Taker' | 'Maker'
  /** The participant address, or `undefined` when the trade lacks this side. */
  address?: WalletAddress
  /** Currently hovered participant address; this cell glows when it matches `address`. */
  hoveredAddress: WalletAddress | null
  onHoverAddress: (address: WalletAddress) => void
  onLeaveAddress: () => void
  onSpectateAddress: (address: WalletAddress) => void
}

export interface TradesState {
  trades: Trade[]
  /** `true` until the initial `snapshot`; flips `false` on the snapshot (even an empty one). See ADR-0030. */
  isLoading: boolean
}

/** Grid column shapes for the tape header and rows; mirrors the CSS class names. */
export type GridVariant = 'base' | 'withTx' | 'withParticipants' | 'withParticipantsTx'
