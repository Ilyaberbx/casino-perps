import { useContext } from 'react'
import { PerpSuggestionSheetContext } from './perp-suggestion-sheet-provider.context'
import type { PerpSuggestionSheetContextValue } from './perp-suggestion-sheet-provider.types'

export function usePerpSuggestionSheet(): PerpSuggestionSheetContextValue {
  const ctx = useContext(PerpSuggestionSheetContext)
  if (!ctx) {
    throw new Error(
      'usePerpSuggestionSheet must be used inside <PerpSuggestionSheetProvider>',
    )
  }
  return ctx
}
