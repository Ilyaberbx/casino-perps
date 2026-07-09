import { requestIdFrom } from '@/modules/shared/http'
import { MAX_STACK_CHARS } from './error-boundary.constants'
import type { ErrorReportInput, NormalizedError } from './error-boundary.types'

/** React Router throws plain `{ status, statusText, data }` for loader/route
 *  failures. Detect the shape structurally so this stays a pure util (no
 *  react-router import). */
function isRouteErrorResponse(value: unknown): value is { status: number; statusText: string } {
  const isObject = typeof value === 'object' && value !== null
  if (!isObject) return false
  const hasStatus = 'status' in value && typeof (value as { status: unknown }).status === 'number'
  const hasStatusText = 'statusText' in value
  return hasStatus && hasStatusText
}

/** Bound a stack so a pathological deep recursion can't bloat the report. */
function clampStack(stack: string | undefined): string | undefined {
  const isPresent = typeof stack === 'string' && stack.length > 0
  if (!isPresent) return undefined
  if (stack.length <= MAX_STACK_CHARS) return stack
  return `${stack.slice(0, MAX_STACK_CHARS)}\n… (truncated)`
}

/** Best-effort human string for a non-Error throw (thrown object/number/etc.). */
function describeUnknown(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    // Circular or non-serializable — fall back to coercion. This catch guards a
    // throwing third-party toJSON at the boundary; see error-handling.md.
    return String(value)
  }
}

/**
 * Reduce any caught value — an `Error`, a React Router route-error response, a
 * bare string, or an arbitrary thrown object — to the typed shape the crash UI
 * renders and reports.
 */
export function normalizeError(error: unknown): NormalizedError {
  const requestId = requestIdFrom(error)

  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: clampStack(error.stack),
      requestId,
    }
  }

  if (isRouteErrorResponse(error)) {
    const statusText = error.statusText || 'Route error'
    return { name: `HTTP ${error.status}`, message: statusText, requestId }
  }

  if (typeof error === 'string') {
    return { name: 'Error', message: error, requestId }
  }

  return { name: 'Error', message: describeUnknown(error), requestId }
}

/** Safe structured log fields for a crash (see logging.md — no bodies, no PII;
 *  a stack is not logged as a field). `requestId` is added only when present so
 *  callers can log unconditionally. */
export function toLogFields(normalized: NormalizedError): Record<string, string> {
  const fields: Record<string, string> = {
    errorName: normalized.name,
    errorMessage: normalized.message,
  }
  if (normalized.requestId) fields.requestId = normalized.requestId
  return fields
}

/** Format the copy-paste report a User drops into Discord. Pure: the hook feeds
 *  in the browser globals so this stays testable in isolation. */
export function buildErrorReport(input: ErrorReportInput): string {
  const lines = [
    '--- Perps DEX error report ---',
    `Time: ${input.timestamp}`,
    `Where: ${input.url}`,
    input.appVersion ? `Build: ${input.appVersion}` : null,
    input.requestId ? `Request ID: ${input.requestId}` : null,
    `Error: ${input.name}: ${input.message}`,
    `Agent: ${input.userAgent}`,
    input.stack ? `\nStack:\n${input.stack}` : null,
    '------------------------------',
  ]
  return lines.filter((line) => line !== null).join('\n')
}
