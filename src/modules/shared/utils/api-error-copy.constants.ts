import type { ErrorCopy, HttpErrorKind, KnownServerErrorCode } from './api-error-copy.types'

/**
 * User-facing copy for the cross-cutting server error codes, keyed by the
 * server's stable `error.code` (the `{ error: { code, message, issues? } }`
 * envelope — server `security.md` #6). Concise, present-tense, actionable.
 */
export const CODE_COPY: Record<KnownServerErrorCode, ErrorCopy> = {
  UPSTREAM_UNAVAILABLE: {
    title: 'Service unavailable',
    description: 'A required service is temporarily unavailable. Please try again shortly.',
  },
  TOO_MANY_REQUESTS: {
    title: 'Too many requests',
    description: "You're going a little fast. Wait a moment and try again.",
  },
  INVALID_REQUEST: {
    title: 'Invalid request',
    description: "That request wasn't accepted. Check the details and try again.",
  },
  PAYLOAD_TOO_LARGE: {
    title: 'Request too large',
    description: 'That request was too large to process.',
  },
  INTERNAL: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
} as const

/**
 * Fallback copy per transport-failure kind, used when no known server code
 * applies. The `api` entry covers an API error whose code is unknown or absent.
 */
export const KIND_COPY: Record<HttpErrorKind, ErrorCopy> = {
  'session-expired': {
    title: 'Session expired',
    description: 'Please log in again to continue.',
  },
  network: {
    title: 'Connection problem',
    description: 'Check your connection and try again.',
  },
  parse: {
    title: 'Unexpected response',
    description: 'We could not read the response. Please try again.',
  },
  api: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
} as const
