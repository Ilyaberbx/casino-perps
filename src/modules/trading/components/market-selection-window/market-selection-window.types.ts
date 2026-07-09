import type { RefObject } from 'react'
import type { Virtualizer } from '@tanstack/react-virtual'
import type { Market } from '@/modules/shared/domain/domain.types'
import type { MarketCategoryTab } from '../../trading.types'
import type { MarketSymbol } from '../../providers/selected-market-provider'

/**
 * The window's tabs are now asset-class categories (All / Crypto / Stocks /
 * Commodities / Indices / FX / Pre-IPO), a 1:1 copy of Minara — replacing the
 * former market-TYPE tabs (ADR-0014 amendment, ADR-0062). Re-exported here so
 * the window's components keep importing the tab type from one place.
 */
export type { MarketCategoryTab }

/**
 * The four category pills that re-sort the visible market list.
 */
export type CategoryPill = 'popular' | 'hot' | 'gainers' | 'losers'

/**
 * A single flat display row. The category-tab model (ADR-0062) produces a flat
 * market list — every row is a market, so this is a single-shape type rather
 * than a discriminated union (the former 'label' asset-class-header arm was
 * removed once the grouping subsystem became dead). The `kind` discriminant is
 * retained so the row renderer reads uniformly.
 */
export type DisplayRow = { kind: 'market'; market: Market }

/**
 * Return shape of the useMarketSelectionWindow smart hook.
 *
 * Note: searchQuery is internal to the hook and NOT exposed here.
 * Consumers receive deferredQuery for display (list filtering) and
 * the handleSearchChange handler to update the input.
 */
export interface UseMarketSelectionWindowReturn {
  activeTab: MarketCategoryTab
  activePill: CategoryPill
  /**
   * The immediate (non-deferred) search string. Binds the controlled
   * <input> so typing is instant — never use deferredQuery for the input.
   */
  searchInputValue: string
  /**
   * The deferred (low-priority) search string used by the display pipeline.
   * Lags behind searchInputValue during concurrent rendering.
   */
  deferredQuery: string
  /**
   * true while the deferred filter list is catching up to the latest search
   * input (deferredQuery !== searchQuery) — drives UI-SPEC §10 opacity:0.7
   * stale state on the market list.
   */
  isFilterStale: boolean
  displayRows: DisplayRow[]
  watchlistRows: Market[]
  isLoading: boolean
  isWatchlistVisible: boolean
  selectedMarket: MarketSymbol
  isFavorite: (symbol: MarketSymbol) => boolean
  handleTabChange: (tab: MarketCategoryTab) => void
  handlePillChange: (pill: CategoryPill) => void
  handleSearchChange: (query: string) => void
  handleSelectMarket: (symbol: MarketSymbol) => void
  handleToggleFavorite: (symbol: MarketSymbol) => void
  /** Ref forwarded to the MarketList ScrollArea viewport (scroll container + virtualizer target). */
  scrollAreaRef: RefObject<HTMLDivElement | null>
  /**
   * Virtualizer for the flat `displayRows` list (ADR-0019). Owns the
   * virtual-item windowing, totalSize, and translateY offsets.
   * `MarketList` consumes `getVirtualItems()` + `getTotalSize()` and
   * indexes back into `displayRows` for each item.
   */
  virtualizer: Virtualizer<HTMLDivElement, Element>
}

export interface MarketRowProps {
  market: Market
  isFavorite: boolean
  isSelected: boolean
  onSelect: (symbol: MarketSymbol) => void
  onToggleFavorite: (symbol: MarketSymbol) => void
}

export interface WatchlistSectionProps {
  rows: Market[]
  selectedMarket: MarketSymbol
  isFavorite: (symbol: MarketSymbol) => boolean
  onSelectMarket: (symbol: MarketSymbol) => void
  onToggleFavorite: (symbol: MarketSymbol) => void
}

export interface MarketSearchInputProps {
  value: string
  onChange: (value: string) => void
}

export interface MarketListProps {
  displayRows: DisplayRow[]
  selectedMarket: MarketSymbol
  isLoading: boolean
  deferredQuery: string
  /**
   * Hook-computed stale flag (deferredQuery !== searchQuery).
   * MarketList applies opacity:0.7 when true per UI-SPEC §10.
   * Do NOT recompute this comparison in the component — the hook is the
   * single source of truth.
   */
  isFilterStale: boolean
  isFavorite: (symbol: MarketSymbol) => boolean
  onSelectMarket: (symbol: MarketSymbol) => void
  onToggleFavorite: (symbol: MarketSymbol) => void
  /** Ref forwarded to the ScrollArea viewport — the virtualizer's scroll element. */
  scrollAreaRef: RefObject<HTMLDivElement | null>
  /** Virtualizer instance from the smart hook (ADR-0019). */
  virtualizer: Virtualizer<HTMLDivElement, Element>
}

export interface MarketSelectionWindowProps {
  isOpen: boolean
  onClose: () => void
  onSelectMarket: (symbol: MarketSymbol) => void
  selectedMarket: MarketSymbol
}
