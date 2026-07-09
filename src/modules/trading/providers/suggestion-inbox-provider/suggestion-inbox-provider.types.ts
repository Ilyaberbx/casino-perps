import type { ReactNode } from 'react'
import type { GetSuggestionInbox } from '../../api/get-suggestion-inbox'

/**
 * The app-level inbox controller (ADR-0073 D-5). The sheet calls `watch` when it
 * fires a suggestion this session; the provider polls `/inbox` while anything is
 * pending (and on window focus), toasts once when a watched/discovered id
 * resolves, and bumps `historyDirtyVersion` so an open History tab refetches.
 */
export interface SuggestionInboxContextValue {
  /** Register a suggestion id fired this session so its resolution toasts. */
  watch(suggestionId: string): void
  /** Monotonic counter bumped on every watched completion — the History tab
   *  re-reads when it changes (and on its own window focus). */
  readonly historyDirtyVersion: number
}

export interface SuggestionInboxProviderProps {
  readonly children: ReactNode
  /** Whether polling is active (the user is authenticated). When false the
   *  provider is inert — no fetch, no poll, no toast. */
  readonly enabled: boolean
  /** The inbox reader, injected at the composition root from the auth apiClient
   *  (and overridable in tests). */
  readonly getInbox: GetSuggestionInbox
  /** Inject the poll scheduler in tests (defaults to `setInterval`). */
  readonly createInterval?: (
    handler: () => void,
    ms: number,
  ) => { clear: () => void }
}
