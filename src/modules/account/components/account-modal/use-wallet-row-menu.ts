import { useCallback, useEffect, useRef, useState } from 'react'
import { useCopyableAddress } from '@/modules/shared/components/copyable-address/use-copyable-address'
import { useWalletExport } from '../../hooks/use-wallet-export'
import type { WalletRowMenuView } from './account-modal.types'

const REMOVE_CONFIRM_MESSAGE =
  'Remove this imported wallet from your account? You can re-import it later.'

/**
 * Open/close state + the `Copy address`, (imported-only) `Remove`, and
 * (exportable-only) `Export private key` actions for a single wallet row's
 * overflow (⋮) menu (PRD-0006 UI-5 / ADR-0076 D-5). The copy action reuses the
 * shared `useCopyableAddress`; `Remove` confirms via the native `window.confirm`
 * before delegating to the parent `onRemove(address)`; `Export` delegates to the
 * shared `useWalletExport` (MFA-gated, owner-only). The visibility of each item
 * is decided by the dumb `WalletRowMenu` from `isRemovable` / `isExportable`.
 * The dropdown itself is positioned by the shared `Popover` (portaled to
 * `document.body`) via `anchorRef`/`panelRef`, so it never collides with rows
 * below it (see ADR-0037).
 */
export function useWalletRowMenu(
  address: string,
  onRemove: (address: string) => void,
): WalletRowMenuView {
  const [isOpen, setIsOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { handleCopy } = useCopyableAddress(address)
  const { onExport: exportWallet } = useWalletExport()

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

  const onCopy = useCallback(() => {
    handleCopy()
    setIsOpen(false)
  }, [handleCopy])

  const onRemoveConfirmed = useCallback(() => {
    setIsOpen(false)
    const confirmed = window.confirm(REMOVE_CONFIRM_MESSAGE)
    if (!confirmed) return
    onRemove(address)
  }, [address, onRemove])

  const onExport = useCallback(() => {
    setIsOpen(false)
    void exportWallet(address)
  }, [address, exportWallet])

  return {
    isOpen,
    anchorRef,
    panelRef,
    onToggle,
    onCopy,
    onRemove: onRemoveConfirmed,
    onExport,
  }
}
