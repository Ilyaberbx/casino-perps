import { createContext } from 'react'
import type { SuggestionPreviewContextValue } from './suggestion-preview-provider.types'

/** Private context for the suggestion-preview controller — consumers use the hook. */
export const SuggestionPreviewContext =
  createContext<SuggestionPreviewContextValue | null>(null)
