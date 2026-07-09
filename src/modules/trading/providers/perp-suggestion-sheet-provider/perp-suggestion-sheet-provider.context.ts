import { createContext } from 'react'
import type { PerpSuggestionSheetContextValue } from './perp-suggestion-sheet-provider.types'

export const PerpSuggestionSheetContext =
  createContext<PerpSuggestionSheetContextValue | null>(null)
