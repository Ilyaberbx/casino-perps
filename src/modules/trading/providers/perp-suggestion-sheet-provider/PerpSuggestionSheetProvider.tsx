import { useCallback, useMemo, useState } from 'react'
import { PerpSuggestionSheetContext } from './perp-suggestion-sheet-provider.context'
import type {
  PerpSuggestionSheetContextValue,
  PerpSuggestionSheetProviderProps,
} from './perp-suggestion-sheet-provider.types'

/**
 * Owns the `{ isOpen, open, close }` controller for the left perp-suggestion
 * sheet (ADR-0045 D-9). Closed by default; production never seeds `defaultOpen`,
 * so the sheet never auto-opens — it opens only when the left-edge toggle calls
 * `open()`. Structural mirror of `agent-balance/agent-balance-sheet`, narrowed
 * from a mode discriminator to a boolean (this sheet hosts one flow).
 */
export function PerpSuggestionSheetProvider({
  children,
  defaultOpen = false,
}: PerpSuggestionSheetProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo<PerpSuggestionSheetContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  )
  return (
    <PerpSuggestionSheetContext.Provider value={value}>
      {children}
    </PerpSuggestionSheetContext.Provider>
  )
}
