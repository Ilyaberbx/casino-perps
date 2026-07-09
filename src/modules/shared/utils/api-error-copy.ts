import { z } from 'zod'
import type { HttpError } from '@/modules/shared/http'
import { CODE_COPY, KIND_COPY } from './api-error-copy.constants'
import type { ErrorCopy, KnownServerErrorCode } from './api-error-copy.types'

/**
 * The server's error envelope (server `DomainExceptionFilter` / `security.md`
 * #6): `{ error: { code?, message?, issues? } }`. Body is `unknown` off the
 * wire, so it is Zod-parsed defensively — a malformed body simply yields no
 * code / message / issues. This is the ONE canonical parse of the envelope on
 * the client; module `api/` wrappers must not re-declare it.
 */
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    issues: z.record(z.string(), z.string()).optional(),
  }),
})

type ServerErrorEnvelope = z.infer<typeof errorEnvelopeSchema>['error']

/** Parse the server envelope out of an `ApiError` body; `null` for a non-API or malformed error. */
function parseEnvelope(error: HttpError): ServerErrorEnvelope | null {
  if (error.kind !== 'api') return null
  const parsed = errorEnvelopeSchema.safeParse(error.body)
  if (!parsed.success) return null
  return parsed.data.error
}

/** The server `error.code`, or `null` when the error is non-API, malformed, or carries no code. */
export function apiErrorCode(error: HttpError): string | null {
  return parseEnvelope(error)?.code ?? null
}

/** The server `error.message` lead line, or `null` when non-API, malformed, or absent. */
export function apiErrorMessage(error: HttpError): string | null {
  return parseEnvelope(error)?.message ?? null
}

/**
 * The field → message map from a 4xx body's `issues` (each line is
 * server-flattened and value-bearing — surfaced verbatim, never re-derived), or
 * `null` when the body carries none.
 */
export function apiErrorIssues(error: HttpError): Record<string, string> | null {
  return parseEnvelope(error)?.issues ?? null
}

function isKnownServerErrorCode(code: string): code is KnownServerErrorCode {
  return code in CODE_COPY
}

/**
 * The shared `HttpError` → user-facing copy mapping — the one standard for
 * showing a transport / API failure to a user. Resolves a known cross-cutting
 * server code first, else falls back to the transport-kind copy (an API error
 * with an unknown / absent code lands on the generic `api` copy). Module-specific
 * codes (`HANDLE_TAKEN`, `INSUFFICIENT_AGENT_BALANCE`, …) are deliberately not
 * mapped here — the owning module overrides this for its own codes so a shared
 * refactor never silently rewords a domain message.
 */
export function toErrorCopy(error: HttpError): ErrorCopy {
  if (error.kind !== 'api') return KIND_COPY[error.kind]
  const code = apiErrorCode(error)
  if (code !== null && isKnownServerErrorCode(code)) return CODE_COPY[code]
  return KIND_COPY.api
}
