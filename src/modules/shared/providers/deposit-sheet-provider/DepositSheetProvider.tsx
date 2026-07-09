import { useCallback, useMemo, useState } from 'react'
import { DepositSheetContext } from './deposit-sheet-provider.context'
import type {
  DepositSheetContextValue,
  DepositSheetProviderProps,
} from './deposit-sheet-provider.types'

/**
 * Owns the `{ isOpen, open, close }` controller for the in-app deposit sheet.
 * Stateless beyond the open/close flag — opening logic lives at the consumers
 * (the three capability-gated `<DepositTrigger>` entry points). Venue-agnostic:
 * this provider knows nothing about which venue (if any) renders a deposit body.
 * Structural mirror of `venue-onboarding-sheet-provider`.
 */
export function DepositSheetProvider({
  children,
  defaultOpen = false,
}: DepositSheetProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo<DepositSheetContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  )
  return (
    <DepositSheetContext.Provider value={value}>{children}</DepositSheetContext.Provider>
  )
}
