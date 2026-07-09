import { useContext } from 'react'
import { SuggestionPreviewContext } from './suggestion-preview-provider.context'
import type { SuggestionPreviewContextValue } from './suggestion-preview-provider.types'

export function useSuggestionPreviewSheet(): SuggestionPreviewContextValue {
  const ctx = useContext(SuggestionPreviewContext)
  if (!ctx) {
    throw new Error(
      'useSuggestionPreviewSheet must be used within <SuggestionPreviewProvider>',
    )
  }
  return ctx
}
