import { useCallback, useMemo, useState } from 'react'
import { TransferSheetContext } from './transfer-sheet-provider.context'
import type {
  TransferPrefill,
  TransferSheetContextValue,
  TransferSheetProviderProps,
} from './transfer-sheet-provider.types'

/**
 * Owns the `{ isOpen, prefill, open, close }` controller for the in-app transfer
 * sheet. The one addition over `deposit-sheet-provider`'s arg-less `open()` is
 * the optional `prefill` (`{ from: 'spot' | 'perps' }`): the Portfolio-page
 * trigger opens with no prefill (default Spot→Perp), the per-row balances button
 * (slice 05) opens with the row's direction. Venue-agnostic: knows nothing about
 * which venue (if any) renders a transfer body. Structural mirror of
 * `deposit-sheet-provider`.
 */
export function TransferSheetProvider({
  children,
  defaultOpen = false,
}: TransferSheetProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [prefill, setPrefill] = useState<TransferPrefill | null>(null)
  const open = useCallback((next?: TransferPrefill) => {
    setPrefill(next ?? null)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo<TransferSheetContextValue>(
    () => ({ isOpen, prefill, open, close }),
    [isOpen, prefill, open, close],
  )
  return (
    <TransferSheetContext.Provider value={value}>{children}</TransferSheetContext.Provider>
  )
}
