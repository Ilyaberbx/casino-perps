import type { ReactNode } from 'react'

/**
 * The open/close controller for the left perp-suggestion sheet (ADR-0045 D-9).
 * The sheet is closed by default and **never auto-opens** — it opens only from
 * the left-edge toggle. `isOpen` is the single source of truth.
 */
export interface PerpSuggestionSheetContextValue {
  readonly isOpen: boolean
  open(): void
  close(): void
}

export interface PerpSuggestionSheetProviderProps {
  readonly children: ReactNode
  /** Test-only seed; production never passes it, so the sheet starts closed. */
  readonly defaultOpen?: boolean
}
