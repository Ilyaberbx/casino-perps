import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  filterTokensBySearch,
  flattenTokenGroups,
  groupTokensByCategory,
} from './perp-suggestion-sheet.utils'
import {
  EMPTY_TOKENS,
  TOKEN_GROUP_HEADER_HEIGHT_PX,
  TOKEN_ROW_HEIGHT_PX,
} from './perp-suggestion-sheet.constants'
import type {
  SuggestionListRow,
  SuggestionToken,
  UseSuggestionTokenListReturn,
} from './perp-suggestion-sheet.types'

export interface UseSuggestionTokenListOptions {
  readonly tokens: readonly SuggestionToken[]
  /** The current selection — resolves the collapsed combobox's icon. */
  readonly selectedSymbol: string
  /** Routed the chosen symbol up to the sheet orchestrator's `setSymbol`. */
  readonly onSelect: (symbol: string) => void
}

/**
 * State for the searchable token combobox (slice 05): the query input + filtered
 * projection plus the dropdown's open/close lifecycle. Selection + the offered set
 * are owned by the sheet orchestrator (this hook is fed the tokens). The dropdown
 * opens on focus / typing and closes on select, Escape, or a pointer-down outside
 * the field; closing always clears the query so the searchbar falls back to
 * showing the current selection and the next open starts from the full list.
 * Search mirrors Market Selection's `filterBySearch` (symbol + base asset,
 * case-insensitive).
 */
export function useSuggestionTokenList(
  options: UseSuggestionTokenListOptions,
): UseSuggestionTokenListReturn {
  const { tokens, selectedSymbol, onSelect } = options
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const deferredQuery = useDeferredValue(query)

  // The filtered list + grouping only ever feed the open dropdown
  // (`SuggestionTokenList` gates both render branches on `isOpen`). While the
  // combobox is collapsed — its resting state — skip filtering up to ~247
  // catalog tokens and return a stable empty projection instead (OPT-1).
  const filteredTokens = useMemo(
    () => (isOpen ? filterTokensBySearch(tokens, deferredQuery) : EMPTY_TOKENS),
    [isOpen, tokens, deferredQuery],
  )

  const groupedTokens = useMemo(
    () => groupTokensByCategory(filteredTokens),
    [filteredTokens],
  )

  // Flatten the grouped sections into one discriminated row list so a single
  // virtualizer can window headers + token rows together (OPT-2, ADR-0019).
  const displayRows = useMemo<readonly SuggestionListRow[]>(
    () => flattenTokenGroups(groupedTokens),
    [groupedTokens],
  )

  // Variable-size virtualizer over the flat displayRows list — token rows and
  // section headers have different heights. Mirrors use-market-selection-window:
  // jsdom never measures clientHeight, so the component carries a pre-measurement
  // fallback (capped) for tests; production hits the virtual window on mount.
  // The `react-hooks/incompatible-library` warning here is the accepted
  // React-Compiler opt-out for TanStack Virtual (mirrors use-market-selection-window).
  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = displayRows[index]
      if (row?.kind === 'header') return TOKEN_GROUP_HEADER_HEIGHT_PX
      return TOKEN_ROW_HEIGHT_PX
    },
    overscan: 8,
    getItemKey: (index) => {
      const row = displayRows[index]
      if (row?.kind === 'token') return row.token.symbol
      if (row?.kind === 'header') return `header-${row.category}`
      return index
    },
    // jsdom does not measure DOM rects; without an initial rect the virtualizer
    // reports zero visible items in tests. Production overrides this with the real
    // ResizeObserver measurement on mount.
    initialRect: { width: 360, height: 240 },
  })

  const selectedMarket = useMemo(() => {
    const match = tokens.find((token) => token.symbol === selectedSymbol)
    return match ? match.market : null
  }, [tokens, selectedSymbol])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
  }, [])

  const onOpen = useCallback(() => setIsOpen(true), [])

  const onSearchChange = useCallback((next: string) => {
    setQuery(next)
    setIsOpen(true)
  }, [])

  const onSelectToken = useCallback(
    (symbol: string) => {
      onSelect(symbol)
      close()
    },
    [onSelect, close],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') close()
    },
    [close],
  )

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent): void => {
      const container = containerRef.current
      const isOutside =
        container !== null &&
        event.target instanceof Node &&
        !container.contains(event.target)
      if (isOutside) close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, close])

  return {
    query,
    filteredTokens,
    groupedTokens,
    displayRows,
    selectedMarket,
    isOpen,
    containerRef,
    scrollRef,
    virtualizer,
    onSearchChange,
    onSelectToken,
    onOpen,
    onKeyDown,
  }
}
