import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useDeferredValue,
  startTransition,
  useSyncExternalStore,
  useRef,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCapability } from '../../../shared/providers/venue-provider'
import { useFavorites } from '../../providers/favorites-provider'
import { iconWarmCache } from '@/modules/shared/services/icon-warm-cache'
import {
  filterByCategory,
  filterBySearch,
  sortByPill,
  collectIconWarmUrls,
} from './market-selection-window.utils'
import { filterByMinVolume } from '../../trading.utils'
import {
  DEFAULT_MARKET_CATEGORY_TAB,
  DEFAULT_CATEGORY_PILL,
} from './market-selection-window.constants'
import { MIN_MARKET_VOLUME_USD } from '../../trading.constants'
import type { MarketCategoryTab } from '../../trading.types'
import type {
  CategoryPill,
  DisplayRow,
  UseMarketSelectionWindowReturn,
} from './market-selection-window.types'
import type { MarketSymbol } from '../../providers/selected-market-provider'

interface UseMarketSelectionWindowProps {
  /** Controlled open state — passed from the parent (use-top-bar.ts). Gates icon warming so a user who never opens the picker never prefetches the icon universe. */
  isOpen: boolean
  onClose: () => void
  onSelectMarket: (symbol: MarketSymbol) => void
  /**
   * The currently-open market, highlighted in the list. Passed in rather than read
   * from `useSelectedMarketContext` so the window can also be rendered by the app
   * shell's `SearchOverlay`, which lives *above* the `/trade/:symbol` route where
   * that provider is mounted (PRD 0008 D15). Committing the selection is likewise
   * the parent's job, via `onSelectMarket`.
   */
  selectedMarket: MarketSymbol
}

/**
 * Smart hook for the MarketSelectionWindow.
 * Owns all state, derived values, and handlers.
 * Passes isFilterStale (not searchQuery) to the dumb list component.
 *
 * NOTE: the live Hyperliquid universe is ~600 markets — past the point where
 * virtualization (ADR-0019) is load-bearing, not optional. startTransition +
 * useDeferredValue keep tab/search responsive on top of the virtualized list.
 */
export function useMarketSelectionWindow({
  isOpen,
  onClose,
  onSelectMarket,
  selectedMarket,
}: UseMarketSelectionWindowProps): UseMarketSelectionWindowReturn {
  const marketDataCap = useCapability('marketData')

  const subscribeMarkets = useCallback(
    (onChange: () => void) => marketDataCap.subscribeMarkets(onChange),
    [marketDataCap],
  )
  const getMarkets = useCallback(() => marketDataCap.listMarkets(), [marketDataCap])
  const markets = useSyncExternalStore(subscribeMarkets, getMarkets)

  const { favoriteSymbols, toggleFavorite } = useFavorites()

  // The liquid universe: drop dust below the volume floor once, up front, so the
  // list, the watchlist, and icon warming all see the same set (ADR-0014
  // amendment). Spot assets are kept — only sub-threshold markets are removed.
  const liquidMarkets = useMemo(
    () => filterByMinVolume(markets, MIN_MARKET_VOLUME_USD),
    [markets],
  )

  // Warm every (liquid) market's icon on idle — but only once the user has opened
  // the picker. Gating on isOpen means a user who never opens it never prefetches
  // the icon universe at startup; on first open the spot-first warm still kills
  // the first-switch and scroll-back flicker per-row warming can't pre-empt.
  // No-op in jsdom (no requestIdleCallback). See `icon-warm-cache`.
  useEffect(() => {
    if (!isOpen || liquidMarkets.length === 0) return
    return iconWarmCache.warmMany(collectIconWarmUrls(liquidMarkets))
  }, [isOpen, liquidMarkets])

  const [activeTab, setActiveTab] =
    useState<MarketCategoryTab>(DEFAULT_MARKET_CATEGORY_TAB)
  const [activePill, setActivePill] = useState<CategoryPill>(DEFAULT_CATEGORY_PILL)

  // searchQuery is internal — it drives the controlled input but is NOT exposed
  // on the return shape. isFilterStale (derived from searchQuery vs deferredQuery)
  // is the only search-related signal the dumb list component receives.
  const [searchQuery, setSearchQuery] = useState('')

  // deferredQuery lags behind searchQuery during concurrent rendering.
  // The display pipeline uses deferredQuery so tab/pill transitions stay responsive.
  const deferredQuery = useDeferredValue(searchQuery)

  const handleTabChange = useCallback((tab: MarketCategoryTab) => {
    startTransition(() => {
      setActiveTab(tab)
    })
  }, [])

  const handlePillChange = useCallback((pill: CategoryPill) => {
    startTransition(() => {
      setActivePill(pill)
    })
  }, [])

  // NOT wrapped in startTransition — the search input must update instantly (Pitfall 1).
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  // Derive display rows from the full pipeline (over the liquid set):
  // filterByCategory → filterBySearch(deferredQuery) → sortByPill → flat rows.
  // The category-tab model produces a flat market list (no asset-class section
  // headers — ADR-0062). MUST depend on deferredQuery (not searchQuery) to align
  // with concurrent rendering (Pitfall 2).
  const displayRows = useMemo<DisplayRow[]>(() => {
    const tabFiltered = filterByCategory(liquidMarkets, activeTab)
    const searchFiltered = filterBySearch(tabFiltered, deferredQuery)
    const sorted = sortByPill(searchFiltered, activePill)
    return sorted.map((market) => ({ kind: 'market' as const, market }))
  }, [liquidMarkets, activeTab, deferredQuery, activePill])

  // watchlistRows: category-filtered intersected with favoriteSymbols (Pitfall 4:
  // tab filter first). Reads the liquid set, so a sub-threshold favorite is hidden.
  const watchlistRows = useMemo(() => {
    const tabFiltered = filterByCategory(liquidMarkets, activeTab)
    return tabFiltered.filter((m) => favoriteSymbols.has(m.symbol))
  }, [liquidMarkets, activeTab, favoriteSymbols])

  const isLoading = markets.length === 0
  const isWatchlistVisible = watchlistRows.length > 0

  // isFavorite: stable callback — MarketRow calls this instead of useFavorites() directly (Pitfall 6)
  const isFavorite = useCallback(
    (symbol: MarketSymbol) => favoriteSymbols.has(symbol),
    [favoriteSymbols],
  )

  const handleToggleFavorite = useCallback(
    (symbol: MarketSymbol) => {
      toggleFavorite(symbol)
    },
    [toggleFavorite],
  )

  const handleSelectMarket = useCallback(
    (symbol: MarketSymbol) => {
      onSelectMarket(symbol)
      onClose()
    },
    [onSelectMarket, onClose],
  )

  // Ref forwarded to the ScrollArea viewport — the actual scrolling element
  // and the virtualizer's scroll target (ADR-0019).
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  // Fixed-size virtualizer for the flat displayRows list. Every row is a
  // MarketRow (48px) — the category-tab model produces a flat market list with
  // no asset-class section headers (ADR-0062).
  const MARKET_ROW_HEIGHT_PX = 48
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollAreaRef.current,
    estimateSize: () => MARKET_ROW_HEIGHT_PX,
    overscan: 8,
    getItemKey: (index) => {
      const row = displayRows[index]
      if (row?.kind === 'market') return row.market.symbol
      return index
    },
    // jsdom does not measure DOM rects; without an initial rect the
    // virtualizer reports zero visible items in tests. Production
    // overrides this with the real ResizeObserver measurement on mount,
    // so the value here is purely for first-render correctness and tests.
    initialRect: { width: 1000, height: 600 },
  })

  // isFilterStale: true while the deferred list is catching up to the latest search input.
  // Computed as a named boolean per code-style.md rule 2.
  // searchQuery is NOT returned — only isFilterStale (and deferredQuery) are exposed.
  const isFilterStale = deferredQuery !== searchQuery

  return {
    activeTab,
    activePill,
    // searchInputValue is the immediate (non-deferred) query — it binds the
    // controlled <input> so typing feels instant. deferredQuery is the lagged
    // value that drives the list pipeline so tab/pill stay responsive.
    searchInputValue: searchQuery,
    deferredQuery,
    isFilterStale,
    displayRows,
    watchlistRows,
    isLoading,
    isWatchlistVisible,
    selectedMarket,
    isFavorite,
    handleTabChange,
    handlePillChange,
    handleSearchChange,
    handleSelectMarket,
    handleToggleFavorite,
    scrollAreaRef,
    virtualizer,
  }
}
