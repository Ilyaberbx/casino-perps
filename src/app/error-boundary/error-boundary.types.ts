import type { ReactNode } from 'react'

/** A crash reduced to the fields we render + report. Never carries the raw
 *  `unknown` — {@link normalizeError} produces this so the UI stays typed. */
export interface NormalizedError {
  name: string
  message: string
  stack?: string
  /** Server correlation id (`x-request-id`) when the crash was an `HttpError`. */
  requestId?: string
}

/** Fields that build the copy-paste report. Kept pure/serializable so the
 *  formatter is a testable util — the hook supplies the browser globals. */
export interface ErrorReportInput extends NormalizedError {
  url: string
  userAgent: string
  /** ISO 8601 timestamp of when the report was built. */
  timestamp: string
  /** App version / build id, when exposed by the bundle. */
  appVersion?: string
}

export interface ErrorFallbackProps {
  /** The caught value — `unknown` by design (render throws, router errors, and
   *  rejected loaders are all untyped at the boundary). */
  error: unknown
}

export interface UseErrorFallbackResult {
  normalized: NormalizedError
  /** The full, formatted report the "Copy" button writes to the clipboard. */
  report: string
  copied: boolean
  /** Clipboard is unavailable in insecure contexts — hide the affordance then. */
  isClipboardSupported: boolean
  /** `mailto:` deep link for the one real support channel (brand inbox). */
  supportMailto: string
  copyReport: () => void
  reload: () => void
  goHome: () => void
}

export interface AppErrorBoundaryProps {
  children: ReactNode
}

export interface AppErrorBoundaryState {
  hasError: boolean
  error: unknown
}

export interface ErrorDetailsProps {
  normalized: NormalizedError
  report: string
}
