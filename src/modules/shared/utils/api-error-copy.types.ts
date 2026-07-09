import type { HttpError } from '@/modules/shared/http'

/** A user-facing error headline + next-step line, ready to drop into a toast / `Callout`. */
export type ErrorCopy = { title: string; description: string }

/** The transport-failure kinds the client maps (mirrors `HttpError`'s `kind` discriminant). */
export type HttpErrorKind = HttpError['kind']

/**
 * The cross-cutting server `error.code` strings (from the server's
 * `shared/http/error-status.ts`) that have a single, module-independent
 * user-facing message. Module-specific codes (`HANDLE_TAKEN`,
 * `INSUFFICIENT_AGENT_BALANCE`, …) are intentionally NOT here — their copy stays
 * in the owning module so a shared refactor can never silently reword a domain
 * message. Add a code here only when ≥2 modules would render it identically.
 */
export type KnownServerErrorCode =
  | 'UPSTREAM_UNAVAILABLE'
  | 'TOO_MANY_REQUESTS'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL'
