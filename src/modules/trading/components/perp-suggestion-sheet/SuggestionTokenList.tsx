// React Compiler memoizes this component's JSX, but the virtualizer's only
// observable change between renders is its internal scroll offset (which the
// compiler cannot see). Without this opt-out the memoized tree would replay the
// same windowed rows at fixed translateY values, so scrolling the dropdown would
// slide rows out of view with nothing replacing them. The `useVirtualizer` call
// site in `use-suggestion-token-list.ts` opts itself out too — this is the
// consumer-side counterpart (mirrors MarketList, ADR-0019).
'use no memo'

import { AssetIcon } from '@/modules/shared/components/asset-icon'
import { RowsSkeleton } from '../rows-skeleton/RowsSkeleton'
import { useSuggestionTokenList } from './use-suggestion-token-list'
import { SuggestionListRowView } from './SuggestionListRowView'
import {
  TOKEN_LIST_EMPTY_COPY,
  TOKEN_LIST_FALLBACK_ROW_CAP,
  TOKEN_LIST_SKELETON_ROWS,
  TOKEN_SEARCH_PLACEHOLDER,
} from './perp-suggestion-sheet.constants'
import styles from './perp-suggestion-sheet.module.css'
import type { SuggestionTokenListProps } from './perp-suggestion-sheet.types'

const SELECTED_ICON_SIZE = 18

/**
 * The market picker — a searchbar + dropdown combobox over Minara's full catalog
 * (ADR-0062). Matches drop down on focus / typing and collapse on select, Escape,
 * or an outside click; the dropdown is grouped into asset-class sections, mirroring
 * Minara. At rest the selected market's icon shows in the input's left gutter. The
 * grouped catalog is windowed with `@tanstack/react-virtual` (OPT-2, ADR-0019):
 * the flat `displayRows` are virtualized so focus never commits all ~247 rows. Dumb:
 * open/close + search + grouping + virtualization live in `useSuggestionTokenList`.
 */
export function SuggestionTokenList({
  label,
  tokens,
  isLoading,
  selectedSymbol,
  onSelect,
}: SuggestionTokenListProps) {
  'use no memo'
  const {
    query,
    displayRows,
    filteredTokens,
    selectedMarket,
    isOpen,
    containerRef,
    scrollRef,
    virtualizer,
    onSearchChange,
    onSelectToken,
    onOpen,
    onKeyDown,
  } = useSuggestionTokenList({ tokens, selectedSymbol, onSelect })

  // The searchbar shows the live query while open, and the current selection at
  // rest — so the chosen market stays visible as the selected value.
  const inputValue = isOpen ? query : selectedSymbol
  const showsSelectedIcon = !isOpen && selectedMarket !== null
  const inputClassName = showsSelectedIcon
    ? `${styles.tokenSearch} ${styles.tokenSearchWithIcon}`
    : styles.tokenSearch

  // Loading takes precedence over the empty-state copy (slice 12): while the
  // allowlist / venue markets resolve, show a skeleton, not "no markets".
  const showSkeleton = isOpen && isLoading
  const showEmpty = isOpen && !isLoading && filteredTokens.length === 0
  const showResults = isOpen && !isLoading && filteredTokens.length > 0

  const virtualItems = virtualizer.getVirtualItems()
  // Defensive fallback for environments where the virtualizer reports zero items
  // despite `initialRect` (notably jsdom — `clientHeight` stays 0 there). Capped
  // at TOKEN_LIST_FALLBACK_ROW_CAP so this single pre-measurement frame never
  // paints the full ~247-symbol catalog un-virtualized (the OPT-2 regression).
  const isPreMeasurement = virtualItems.length === 0 && displayRows.length > 0

  return (
    <div className={styles.field} ref={containerRef}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.combobox}>
        {showsSelectedIcon ? (
          <span className={styles.comboboxIcon} data-testid="token-selected-icon">
            <AssetIcon market={selectedMarket} size={SELECTED_ICON_SIZE} />
          </span>
        ) : null}
        <input
          type="search"
          className={inputClassName}
          placeholder={TOKEN_SEARCH_PLACEHOLDER}
          value={inputValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onOpen}
          onKeyDown={onKeyDown}
          data-testid="token-search"
        />
        {showSkeleton ? (
          <div className={styles.dropdown} data-testid="token-list-loading">
            <RowsSkeleton
              rows={TOKEN_LIST_SKELETON_ROWS}
              className={styles.tokenSkeleton}
            />
          </div>
        ) : null}
        {showEmpty ? (
          <div className={styles.dropdown}>
            <p className={styles.hint} data-testid="token-list-empty">
              {TOKEN_LIST_EMPTY_COPY}
            </p>
          </div>
        ) : null}
        {showResults && isPreMeasurement ? (
          <div className={styles.dropdown} data-testid="token-list" ref={scrollRef}>
            {displayRows.slice(0, TOKEN_LIST_FALLBACK_ROW_CAP).map((row) => (
              <div key={row.kind === 'token' ? row.token.symbol : `header-${row.category}`}>
                <SuggestionListRowView
                  row={row}
                  selectedSymbol={selectedSymbol}
                  onSelect={onSelectToken}
                />
              </div>
            ))}
          </div>
        ) : null}
        {showResults && !isPreMeasurement ? (
          <div className={styles.dropdown} data-testid="token-list" ref={scrollRef}>
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualItem) => {
                const row = displayRows[virtualItem.index]
                if (!row) return null
                return (
                  <div
                    key={virtualItem.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <SuggestionListRowView
                      row={row}
                      selectedSymbol={selectedSymbol}
                      onSelect={onSelectToken}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
