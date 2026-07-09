import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  buildRecipientGroups,
  clampActiveIndex,
  filterRecipientSuggestions,
} from './recipient-combobox.utils'
import type {
  RecipientComboboxView,
  UseRecipientComboboxParams,
} from './recipient-combobox.types'

/**
 * Owns the recipient combobox's local UI state (open/close, keyboard cursor) on
 * behalf of a host form — the host is the single state owner for the dumb
 * `RecipientCombobox` widget. It never validates; it only writes the value via
 * `onChange`. Suggestions are filtered live against the typed value across both
 * groups (`Your wallets` / `Recent`), which share one flat index space so the
 * arrow-key cursor crosses both. The panel dismisses on an outside pointer or
 * Escape. Static presentational config (`inputId` / `ariaLabel` / `placeholder` /
 * `isInvalid`) is threaded straight through to the view.
 */
export function useRecipientCombobox(
  params: UseRecipientComboboxParams,
): RecipientComboboxView {
  const {
    value,
    walletSuggestions,
    recentSuggestions,
    onChange,
    inputId,
    label,
    hint,
    ariaLabel,
    placeholder,
    isInvalid,
    invalidReason,
  } = params

  const [isRawOpen, setIsRawOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const filteredWallets = useMemo(
    () => filterRecipientSuggestions(walletSuggestions, value),
    [walletSuggestions, value],
  )
  const filteredRecents = useMemo(
    () => filterRecipientSuggestions(recentSuggestions, value),
    [recentSuggestions, value],
  )
  const { groups, flatCount } = useMemo(
    () => buildRecipientGroups(filteredWallets, filteredRecents, activeIndex),
    [filteredWallets, filteredRecents, activeIndex],
  )

  const hasSuggestions = flatCount > 0
  const isOpen = isRawOpen && hasSuggestions
  const flatOptions = useMemo(() => groups.flatMap((group) => group.options), [groups])
  const activeOption = isOpen ? flatOptions[activeIndex] ?? null : null
  const activeOptionId = activeOption?.id ?? null

  // Dismiss on outside pointer while open. The panel is portaled, so a click
  // inside it is outside the anchor's DOM subtree — both refs are checked.
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      const insideAnchor = anchorRef.current?.contains(target) ?? false
      const insidePanel = panelRef.current?.contains(target) ?? false
      if (insideAnchor || insidePanel) return
      setIsRawOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen])

  function selectAddress(address: string) {
    onChange(address)
    setIsRawOpen(false)
  }

  function onInputChange(next: string) {
    onChange(next)
    setActiveIndex(0)
    setIsRawOpen(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const isEscapeWhileOpen = event.key === 'Escape' && isOpen
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsRawOpen(true)
      setActiveIndex((current) => clampActiveIndex(current + 1, flatCount))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => clampActiveIndex(current - 1, flatCount))
      return
    }
    // Inline the null-check (not a named boolean) so TS narrows `activeOption`.
    if (event.key === 'Enter' && activeOption !== null) {
      event.preventDefault()
      selectAddress(activeOption.address)
      return
    }
    if (isEscapeWhileOpen) {
      event.preventDefault()
      setIsRawOpen(false)
    }
  }

  return {
    value,
    inputId,
    label,
    hint,
    ariaLabel,
    placeholder,
    isInvalid,
    invalidReason,
    isOpen,
    hasSuggestions,
    groups,
    activeOptionId,
    anchorRef,
    panelRef,
    onInputChange,
    onFocus: () => setIsRawOpen(true),
    onToggle: () => setIsRawOpen((open) => !open),
    onKeyDown,
    onSelect: selectAddress,
  }
}
