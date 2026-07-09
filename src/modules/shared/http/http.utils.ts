import type { AxiosResponse } from 'axios'
import { ApiError } from './errors'
import type { HttpError } from './http.types'

/** The server's correlation-id header (mirrors the server `REQUEST_ID_HEADER`). */
export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Read the server's `x-request-id` off an Axios response. Axios lower-cases
 * response header keys; the value is `undefined` when the server omitted it.
 */
export function readRequestId(response: AxiosResponse): string | undefined {
  const raw = response.headers[REQUEST_ID_HEADER]
  const hasId = typeof raw === 'string' && raw.length > 0
  return hasId ? raw : undefined
}

/**
 * Dig the server correlation id out of a failure for logging. Handles both a
 * raw `HttpError` (the transport's `ApiError`) and a domain error that wraps an
 * `HttpError` one level down in `.cause` (e.g. `DelegationGrantError('server',
 * …, httpError)`). Returns `undefined` for failures that never reached the
 * server (network errors, venue/on-chain errors), so callers can spread it
 * conditionally.
 */
export function requestIdFrom(value: unknown): string | undefined {
  if (value instanceof ApiError) return value.requestId
  const isCauseCarrier =
    typeof value === 'object' && value !== null && 'cause' in value
  if (!isCauseCarrier) return undefined
  const cause = (value as { cause: unknown }).cause
  if (cause instanceof ApiError) return cause.requestId
  return undefined
}

/**
 * Safe, structured log fields for any `HttpError` — the standard observability
 * shape across feature modules. Always carries `kind`; adds `status` + the
 * server `requestId` when the failure is an `ApiError`. Never includes the
 * response body (which may carry sensitive data) — only the correlation id.
 */
export function describeHttpError(
  error: HttpError,
): { kind: HttpError['kind']; status?: number; requestId?: string } {
  if (error.kind !== 'api') return { kind: error.kind }
  return { kind: error.kind, status: error.status, requestId: error.requestId }
}
