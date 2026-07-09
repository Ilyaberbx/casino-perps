// React Compiler memoizes this component's JSX. All of its props
// (`virtualizer`, `displayRows`, callbacks) keep stable identity across
// renders — only the virtualizer's internal scroll offset changes when
// the user scrolls, and the compiler cannot see that. Without this
// directive the memoized tree replays the same ~20 absolute-positioned
// rows at the same `translateY` values forever, so scrolling makes rows
// slide out of view with nothing replacing them. The `useVirtualizer`
// call site already opts itself out (see the lint warning in
// `use-market-selection-window.ts:149`); this is the consumer-side
// counterpart of that opt-out.
'use no memo'

import styles from './market-selection-window.module.css'
import { ScrollArea } from '@/modules/shared/components/scroll-area'
import { PlaceholderMessage } from '@/modules/shared/components/placeholder-message'
import { MarketRow } from './MarketRow'
import { FALLBACK_ROW_CAP } from './market-selection-window.constants'
import type { MarketListProps } from './market-selection-window.types'

/**
 * Dumb list component — ScrollArea + loading/empty states + virtualized
 * row rendering (ADR-0019). Applies opacity:0.7 when isFilterStale is
 * true (UI-SPEC §10).
 *
 * isFilterStale is passed in from the hook (deferredQuery !== searchQuery
 * computed there). Do NOT re-derive this comparison inside MarketList —
 * the hook is the single source of truth.
 *
 * Guard-clause ordering (code-style.md rule 1):
 * 1. isLoading → loading placeholder
 * 2. isEmptySearch → no-results placeholder
 * 3. isEmptyCategory → no-markets placeholder
 * 4. default → render virtualized list with optional opacity stale indicator
 *
 * The list body is a sized container with absolute-positioned rows; only
 * the virtualizer's reported `getVirtualItems()` are rendered (typically
 * ~20 at any scroll position). See ADR-0019.
 */
export function MarketList({
  displayRows,
  selectedMarket,
  isLoading,
  deferredQuery,
  isFilterStale,
  isFavorite,
  onSelectMarket,
  onToggleFavorite,
  scrollAreaRef,
  virtualizer,
}: MarketListProps) {
  'use no memo'
  if (isLoading) {
    return (
      <PlaceholderMessage message="LOADING MARKETS">Fetching market data…</PlaceholderMessage>
    )
  }

  const hasQuery = deferredQuery.length > 0
  const isEmptySearch = hasQuery && displayRows.length === 0

  if (isEmptySearch) {
    return (
      <PlaceholderMessage message="NO RESULTS">
        No markets match &ldquo;{deferredQuery}&rdquo;. Try a different symbol or name.
      </PlaceholderMessage>
    )
  }

  const isEmptyCategory = !hasQuery && displayRows.length === 0

  if (isEmptyCategory) {
    return (
      <PlaceholderMessage message="NO MARKETS">
        No markets available in this category.
      </PlaceholderMessage>
    )
  }

  const scrollAreaStyle: React.CSSProperties = {
    opacity: isFilterStale ? 0.7 : 1,
    transition: 'opacity 80ms steps(2, end)',
  }

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Defensive fallback for environments where the virtualizer reports
  // zero items despite `initialRect` (notably jsdom — `clientHeight`
  // stays 0 there regardless of the ResizeObserver polyfill, so the
  // virtualizer cannot derive a visible window). Production hits the
  // virtual branch below as soon as ResizeObserver fires after mount.
  // Capped at FALLBACK_ROW_CAP so this single pre-measurement frame never
  // paints the full ~600-market universe (the CRITICAL perf regression).
  const isPreMeasurement = virtualItems.length === 0 && displayRows.length > 0

  if (isPreMeasurement) {
    return (
      <ScrollArea
        ariaLabel="Market list"
        className={styles.listScrollArea}
        style={scrollAreaStyle}
        viewportRef={scrollAreaRef}
      >
        {displayRows.slice(0, FALLBACK_ROW_CAP).map((row) => (
          <MarketRow
            key={row.market.symbol}
            market={row.market}
            isFavorite={isFavorite(row.market.symbol)}
            isSelected={row.market.symbol === selectedMarket}
            onSelect={onSelectMarket}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </ScrollArea>
    )
  }

  return (
    <ScrollArea
      ariaLabel="Market list"
      className={styles.listScrollArea}
      style={scrollAreaStyle}
      viewportRef={scrollAreaRef}
    >
      <div
        style={{
          height: totalSize,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const row = displayRows[virtualItem.index]
          const rowStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
            height: virtualItem.size,
          }
          if (row?.kind === 'market') {
            return (
              <div key={virtualItem.key} style={rowStyle}>
                <MarketRow
                  market={row.market}
                  isFavorite={isFavorite(row.market.symbol)}
                  isSelected={row.market.symbol === selectedMarket}
                  onSelect={onSelectMarket}
                  onToggleFavorite={onToggleFavorite}
                />
              </div>
            )
          }
          return null
        })}
      </div>
    </ScrollArea>
  )
}
