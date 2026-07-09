import { z } from 'zod'
import { err, ok, type Result } from 'neverthrow'

/**
 * Client mirror of the server handle contract (`apps/server/src/account/account.dto.ts`).
 * `packages/` is empty, so the regex + bounds are duplicated here verbatim; keep
 * the two copies in lock-step (PRD-0006 Slice 03 / Slice B).
 */
export const HANDLE_REGEX = /^[a-zA-Z0-9_-]+$/
const HANDLE_MIN = 3
const HANDLE_MAX = 50

export const handleSchema = z
  .string()
  .min(HANDLE_MIN, 'Handle must be at least 3 characters')
  .max(HANDLE_MAX, 'Handle must be at most 50 characters')
  .regex(
    HANDLE_REGEX,
    'Handle can only contain letters, numbers, underscores, and hyphens',
  )
  .transform((h) => h.toLowerCase().trim())

/**
 * Parse a raw handle into its normalised form, returning the first format-issue
 * message as the error so the stepper can render it inline. The schema bounds
 * are checked before the regex, so the most specific message surfaces first.
 */
export function parseHandle(raw: string): Result<string, string> {
  const parsed = handleSchema.safeParse(raw)
  if (parsed.success) return ok(parsed.data)
  return err(parsed.error.issues[0]?.message ?? 'Invalid handle')
}
