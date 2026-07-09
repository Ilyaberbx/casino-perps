import { createContext } from 'react'
import type { SuggestionInboxContextValue } from './suggestion-inbox-provider.types'

/** Private context for the inbox controller — consumers use the hook. */
export const SuggestionInboxContext =
  createContext<SuggestionInboxContextValue | null>(null)
