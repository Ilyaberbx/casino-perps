import { z } from 'zod'
import type { HttpError } from '@/modules/shared/http'
import { apiErrorCode, apiErrorIssues } from '@/modules/shared/utils/api-error-copy'
import type { HandleAvailability, HandleCheck } from './onboarding-stepper.types'

const emailSchema = z.string().email()

/**
 * Maps an onboard failure to an inline invite-code message, or `null` when the
 * failure is not invite-related (so the caller falls back to its handle-error
 * toast). Covers an unknown code (`INVALID_INVITE_CODE`), an already-used code
 * (`INVITE_CODE_ALREADY_REDEEMED`), and a malformed code rejected by server-side
 * Zod (`INVALID_REQUEST` with an `inviteCode` field issue). A malformed *handle*
 * carries an `issues.handle` key instead, so it is correctly ignored here.
 */
export function inviteErrorFrom(error: HttpError): string | null {
  const code = apiErrorCode(error)
  if (code === 'INVALID_INVITE_CODE') return 'Invalid invite code'
  if (code === 'INVITE_CODE_ALREADY_REDEEMED') return 'Invite code already used'
  if (apiErrorIssues(error)?.inviteCode !== undefined) return 'Invalid invite code'
  return null
}

/**
 * Maps a non-invite onboard failure to the toast shown next to the Continue
 * button. Only a real `HANDLE_TAKEN` (409) gets the handle-specific copy — every
 * other failure (server 500/`INTERNAL`, Privy `UPSTREAM_UNAVAILABLE`, session,
 * network) gets honest copy, never "handle may already be taken". This is the fix
 * for the bug where a 500 from onboard was disguised as a taken handle while the
 * handle was actually free. Invite-specific errors are handled earlier by
 * `inviteErrorFrom`, so they never reach here.
 */
export function submitErrorToast(error: HttpError): { title: string; description: string } {
  const generic = {
    title: 'Could not continue',
    description: 'Something went wrong. Please try again.',
  }
  if (error.kind === 'session-expired') {
    return { title: 'Session expired', description: 'Please log in again to continue.' }
  }
  if (error.kind === 'network') {
    return {
      title: 'Connection problem',
      description: 'Check your connection and try again.',
    }
  }
  const code = apiErrorCode(error)
  if (code === 'HANDLE_TAKEN') {
    return {
      title: 'Could not set handle',
      description: 'That handle may already be taken. Try another.',
    }
  }
  if (code === 'UPSTREAM_UNAVAILABLE') {
    return {
      title: 'Service unavailable',
      description: 'A required service is temporarily unavailable. Please try again shortly.',
    }
  }
  return generic
}

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success
}

/**
 * Derives the displayed availability from the normalised handle and the last
 * completed check. `idle` with no valid handle; `checking` while a debounce is
 * pending or the completed check is for a stale handle; otherwise the resolved
 * status. Keeps the indicator derived (no setState-in-effect for idle/checking).
 */
export function deriveAvailability(
  normalised: string | null,
  check: HandleCheck | null,
): HandleAvailability {
  if (normalised === null) return 'idle'
  if (check === null || check.handle !== normalised) return 'checking'
  return check.status
}
