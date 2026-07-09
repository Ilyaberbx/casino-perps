import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOnboardingFlow } from '../../hooks/use-onboarding-flow'
import { useWalletMutations } from '../../hooks/use-wallet-mutations'
import { useMediaQuery } from '@/modules/shared/hooks/use-media-query'
import { toItem } from './quick-wallet-switcher.utils'
import type { QuickWalletItem, QuickWalletSwitcherView } from './quick-wallet-switcher.types'

// Keep in sync with the `max-width: 560px` header-condense query in
// app-shell.module.css: below it the header runs out of room, so the switcher
// trigger drops its label to an avatar-only chip (mirrors VenueSwitcher).
const HEADER_COMPACT_QUERY = '(max-width: 560px)'

/**
 * Header Quick-Wallet Switcher (quick action). Lists the user's wallets and
 * drives the Selected Wallet + Import via the shared `useWalletMutations` hook,
 * so it stays in lock-step with the Account Modal Wallets section (single source
 * of truth via `applyMe`). Owns only the popover open/close + the option mapping;
 * all server mutation logic lives in `useWalletMutations`.
 */
export function useQuickWalletSwitcher(): QuickWalletSwitcherView {
  const flow = useOnboardingFlow()
  const mutations = useWalletMutations()
  const isCompact = useMediaQuery(HEADER_COMPACT_QUERY)

  const isReady = flow.kind === 'ready'

  const items = useMemo<ReadonlyArray<QuickWalletItem>>(
    () => (flow.kind === 'ready' ? flow.me.wallets : []).map(toItem),
    [flow],
  )
  const value = mutations.selectedAddress ?? ''
  const triggerItem = items.find((i) => i.value === value) ?? items[0] ?? null

  const [isOpen, setIsOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const onToggle = useCallback(() => setIsOpen((open) => !open), [])

  // Dismiss on outside pointer / Escape while open. The panel is portaled, so a
  // click inside it is outside the anchor's DOM subtree — both refs are checked.
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      const insideAnchor = anchorRef.current?.contains(target) ?? false
      const insidePanel = panelRef.current?.contains(target) ?? false
      if (insideAnchor || insidePanel) return
      setIsOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const { onSelect, onImport } = mutations

  const onSelectWallet = useCallback(
    (address: string) => {
      onSelect(address)
      setIsOpen(false)
    },
    [onSelect],
  )

  const onImportWallet = useCallback(() => {
    onImport()
    setIsOpen(false)
  }, [onImport])

  return {
    isReady,
    triggerItem,
    items,
    value,
    isOpen,
    isCompact,
    isImporting: mutations.isImporting,
    isImportAtCap: mutations.isImportAtCap,
    importHint: mutations.importHint,
    anchorRef,
    panelRef,
    onToggle,
    onSelectWallet,
    onImport: onImportWallet,
  }
}
