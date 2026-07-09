import { useCallback, useMemo, useState } from 'react'
import { SuggestionPreviewContext } from './suggestion-preview-provider.context'
import type {
  PreviewTarget,
  SuggestionPreviewContextValue,
  SuggestionPreviewProviderProps,
} from './suggestion-preview-provider.types'

/**
 * Owns the `{ target, open, close }` controller for the right-side suggestion
 * preview (ADR-0048, slice 10). Closed by default; opened by a successful
 * execute or a history re-open. Mounted at the app composition root so the
 * preview can render as a sibling of the chart (which stays visible behind it).
 */
export function SuggestionPreviewProvider({
  children,
  defaultTarget = null,
}: SuggestionPreviewProviderProps) {
  const [target, setTarget] = useState<PreviewTarget | null>(defaultTarget)
  const open = useCallback((next: PreviewTarget) => setTarget(next), [])
  const close = useCallback(() => setTarget(null), [])
  const value = useMemo<SuggestionPreviewContextValue>(
    () => ({ target, open, close }),
    [target, open, close],
  )
  return (
    <SuggestionPreviewContext.Provider value={value}>
      {children}
    </SuggestionPreviewContext.Provider>
  )
}
