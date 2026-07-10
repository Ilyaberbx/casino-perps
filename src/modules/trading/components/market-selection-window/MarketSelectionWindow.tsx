import { X } from 'lucide-react'
import { useMarketSelectionWindow } from './use-market-selection-window'
import { Modal } from '@/modules/shared/components/modal'
import { IconButton } from '@/modules/shared/components/icon-button'
import { TabBar } from '@/modules/shared/components/tab-bar'
import { SegmentedControl } from '@/modules/shared/components/segmented-control'
import { MarketSearchInput } from './MarketSearchInput'
import { MarketList } from './MarketList'
import { MarketListHeader } from './MarketListHeader'
import { WatchlistSection } from './WatchlistSection'
import styles from './market-selection-window.module.css'
import { MARKET_CATEGORY_TABS, CATEGORY_PILLS } from './market-selection-window.constants'
import type {
  MarketSelectionWindowProps,
  MarketCategoryTab,
  CategoryPill,
} from './market-selection-window.types'

const MARKET_CATEGORY_TAB_OPTIONS = MARKET_CATEGORY_TABS.map((t) => ({
  value: t.value,
  label: t.label,
}))
const CATEGORY_PILL_OPTIONS = CATEGORY_PILLS.map((p) => ({ value: p.value, label: p.label }))

/**
 * Dumb root component for the MarketSelectionWindow.
 *
 * Calls useMarketSelectionWindow once at the top and passes prop slices
 * to each dumb sub-component. No local state. No useEffect. No useCallback.
 * The smart hook owns all state, filtering, sorting, and handlers.
 *
 * JSX structure:
 *   Modal
 *   └── windowBody wrapper (margin: -20px cancels Modal's 20px body padding)
 *       ├── windowHeader: MarketSearchInput + close button
 *       ├── TabBar (fitted — market type tabs)
 *       ├── pillRow: SegmentedControl (category pills)
 *       ├── WatchlistSection (null when empty)
 *       └── MarketList (ScrollArea + loading/empty/list states)
 */
export function MarketSelectionWindow({
  isOpen,
  onClose,
  onSelectMarket,
  selectedMarket,
}: MarketSelectionWindowProps) {
  // The React Compiler memoizes the `<MarketList />` JSX element below.
  // All of MarketList's props keep stable identity across renders (callbacks
  // via `useCallback`, the `virtualizer` instance from `useVirtualizer`,
  // `displayRows` via `useMemo`). Without this opt-out, the compiler returns
  // the cached JSX element on every render — React sees the same element
  // reference and bails out before MarketList's render function ever runs.
  // The virtualizer's internal scroll-offset update is invisible to the
  // compiler, so scrolling never triggers a fresh `getVirtualItems()` call
  // and the same ~20 absolute-positioned rows freeze in place. The hook
  // already opts itself out (lint warning at use-market-selection-window.ts:149);
  // this is the JSX-creation-site counterpart.
  'use no memo'
  const {
    activeTab,
    activePill,
    searchInputValue,
    deferredQuery,
    isFilterStale,
    displayRows,
    watchlistRows,
    isLoading,
    isFavorite,
    handleTabChange,
    handlePillChange,
    handleSearchChange,
    handleSelectMarket,
    handleToggleFavorite,
    scrollAreaRef,
    virtualizer,
  } = useMarketSelectionWindow({ isOpen, onClose, onSelectMarket, selectedMarket })

  // Render the body only while open. The Modal stays `keepMounted` (its hidden
  // shell), and this component is always mounted by TopBar, so the hook above
  // keeps all state (tab, search, favorites) across open/close. Gating here is
  // the CRITICAL perf fix: a closed `keepMounted` modal otherwise renders the
  // entire ~600-market universe (virtualization is defeated when the hidden
  // scroll viewport has zero height — see MarketList's pre-measurement branch).
  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Select Market" hideClose keepMounted>
      {isOpen ? (
        <div className={styles.windowBody}>
          <div className={styles.windowHeader}>
            <MarketSearchInput value={searchInputValue} onChange={handleSearchChange} />
            <IconButton
              icon={X}
              ariaLabel="Close market selection"
              title="Close"
              onClick={onClose}
            />
          </div>

          <div className={styles.tabBarRow}>
            <TabBar<MarketCategoryTab>
              tabs={MARKET_CATEGORY_TAB_OPTIONS}
              value={activeTab}
              onChange={handleTabChange}
              fitted
              ariaLabel="Market category tabs"
            />
          </div>

          <div className={styles.pillRow}>
            <SegmentedControl<CategoryPill>
              options={CATEGORY_PILL_OPTIONS}
              value={activePill}
              onChange={handlePillChange}
              ariaLabel="Category filter"
            />
          </div>

          <MarketListHeader />

          <WatchlistSection
            rows={watchlistRows}
            selectedMarket={selectedMarket}
            isFavorite={isFavorite}
            onSelectMarket={handleSelectMarket}
            onToggleFavorite={handleToggleFavorite}
          />

          <MarketList
            displayRows={displayRows}
            selectedMarket={selectedMarket}
            isLoading={isLoading}
            deferredQuery={deferredQuery}
            isFilterStale={isFilterStale}
            isFavorite={isFavorite}
            onSelectMarket={handleSelectMarket}
            onToggleFavorite={handleToggleFavorite}
            scrollAreaRef={scrollAreaRef}
            virtualizer={virtualizer}
          />
        </div>
      ) : null}
    </Modal>
  )
}
