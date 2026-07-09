import type { ReactNode } from 'react'
import { PerpSuggestionSheetContext } from '../perp-suggestion-sheet-provider.context'
import type { PerpSuggestionSheetContextValue } from '../perp-suggestion-sheet-provider.types'

const defaultValue: PerpSuggestionSheetContextValue = {
  isOpen: true,
  open: () => undefined,
  close: () => undefined,
}

interface FakePerpSuggestionSheetProviderProps {
  children: ReactNode
  value?: Partial<PerpSuggestionSheetContextValue>
}

export function FakePerpSuggestionSheetProvider({
  children,
  value,
}: FakePerpSuggestionSheetProviderProps) {
  const merged: PerpSuggestionSheetContextValue = { ...defaultValue, ...value }
  return (
    <PerpSuggestionSheetContext.Provider value={merged}>
      {children}
    </PerpSuggestionSheetContext.Provider>
  )
}
