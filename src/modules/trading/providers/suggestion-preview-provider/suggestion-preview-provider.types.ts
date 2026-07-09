import type { ReactNode } from 'react'
import type { StoredSuggestion } from '../../api/suggestions.types'

/** What the right-side preview is showing, and whether it is read-only (expired). */
export interface PreviewTarget {
  readonly suggestion: StoredSuggestion
  readonly readOnly: boolean
}

/**
 * The preview controller (ADR-0048, slice 10). A successful execute and a
 * still-valid history re-open both call `open`; an expired history row opens
 * read-only. `target === null` keeps the preview Sheet closed.
 */
export interface SuggestionPreviewContextValue {
  readonly target: PreviewTarget | null
  open(target: PreviewTarget): void
  close(): void
}

export interface SuggestionPreviewProviderProps {
  readonly children: ReactNode
  readonly defaultTarget?: PreviewTarget | null
}
