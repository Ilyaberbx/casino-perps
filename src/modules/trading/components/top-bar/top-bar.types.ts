import type { ReactNode } from 'react'
import type { Market, Ticker } from '../../../shared/domain/domain.types'
import type { MarketSymbol } from '../../providers/selected-market-provider'

/**
 * Props the `TopBar` shell accepts from its host. `mobileAction` is an optional
 * node rendered in the mobile identity row beside the market dropdown — the trade
 * page passes its compact Place Order button here so the order-ticket trigger
 * sits next to the market selector without coupling `TopBar` to the order sheet.
 */
export interface TopBarProps {
  mobileAction?: ReactNode
}

/**
 * Cells shared by every market type (Mark + 24h Change + 24h Volume).
 * The per-type variants below extend this; omitted cells are structurally
 * absent (D-02/D-02a — omit, do not dash).
 */
export interface MarketStripStatsBase {
  markPriceText: string
  change24hText: string
  change24hDirection: 'up' | 'down'
  volume24hText: string
}

/** Spot: shared cells only — no oracle, no open interest, no funding. */
export interface SpotMarketStripStats extends MarketStripStatsBase {
  marketType: 'spot'
}

/** HIP-3: shared cells + Oracle/Index — no open interest, no funding. */
export interface Hip3MarketStripStats extends MarketStripStatsBase {
  marketType: 'hip3'
  oraclePriceText: string
}

/** Perp: full cell set — shared + Oracle + Open Interest + Funding/Countdown. */
export interface PerpMarketStripStats extends MarketStripStatsBase {
  marketType: 'perp'
  oraclePriceText: string
  openInterestText: string
  fundingRateText: string
  fundingRateDirection: 'up' | 'down'
  fundingCountdownText: string
}

export type MarketStripStats =
  | SpotMarketStripStats
  | Hip3MarketStripStats
  | PerpMarketStripStats

/**
 * The market-header trigger's display label (LOCKED DECISION c). `label` is the
 * stripped symbol (`BTC`, or the HIP-3 asset segment); `dexTag` is the HIP-3 dex
 * badge (`XYZ`) or `null` for perp/spot. Distinct from `selectedMarket`, which
 * stays the routing identity symbol.
 */
export interface MarketHeaderLabel {
  label: string
  dexTag: string | null
}

/**
 * The slice of `useTopBar()` both layout views consume. `TopBar` picks the
 * mobile or desktop view on `isMobile` and spreads its hook return in; the
 * views read only these fields (`isMobile`, `ticker`, `setSelectedMarket` are
 * orchestration-only and stay out of the view contract).
 */
export interface TopBarViewProps {
  /** Optional action node rendered in the mobile identity row (see `TopBarProps`). */
  mobileAction?: ReactNode
  selectedMarket: MarketSymbol
  market: Market
  marketHeaderLabel: MarketHeaderLabel
  /** True once `market` is a resolved `Market` with `baseAsset` — gates the AssetIcon render. */
  hasResolvedMarket: boolean
  isWindowOpen: boolean
  openWindow: () => void
  closeWindow: () => void
  handleSelectMarket: (symbol: MarketSymbol) => void
  stats: MarketStripStats | null
  /** Direction of the latest mark-price change, for the tick flash (null = unchanged/first). */
  markFlash: 'up' | 'down' | null
  isFavorite: boolean
  toggleFavorite: () => void
}

export interface UseTopBarReturn extends TopBarViewProps {
  setSelectedMarket: (market: MarketSymbol) => void
  /** True below the mobile breakpoint — selects the stacked mobile header layout. */
  isMobile: boolean
  ticker: Ticker | null
}

export interface TickerState {
  ticker: Ticker | null
}

export interface TickerStatsProps {
  stats: MarketStripStats | null
  /** Direction of the latest mark-price change, for the tick flash. */
  markFlash: 'up' | 'down' | null
}

export interface FavoriteStarProps {
  isFavorite: boolean
  onToggle: () => void
}

export interface MarketDropdownButtonProps {
  /** Stripped display label (`BTC` / HIP-3 asset segment) — not the routing symbol. */
  label: string
  /** HIP-3 dex badge (`XYZ`), or `null` for perp/spot. */
  dexTag: string | null
  isOpen: boolean
  onClick: () => void
}
