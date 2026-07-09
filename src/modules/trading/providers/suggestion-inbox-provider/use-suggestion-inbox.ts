import { useContext } from 'react'
import { SuggestionInboxContext } from './suggestion-inbox-provider.context'
import type { SuggestionInboxContextValue } from './suggestion-inbox-provider.types'

export function useSuggestionInbox(): SuggestionInboxContextValue {
  const ctx = useContext(SuggestionInboxContext)
  if (!ctx) {
    throw new Error(
      'useSuggestionInbox must be used within <SuggestionInboxProvider>',
    )
  }
  return ctx
}
