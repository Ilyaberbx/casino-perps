import type { SuggestionOutcome } from '../../api/suggestions.types'

/** A resolved outcome the user has not yet been toasted about (ADR-0073 D-5). */
export interface PendingToast {
  readonly id: string
  readonly status: 'completed' | 'failed'
  readonly symbol: string
  readonly failureReason: string | null
}

/** Whether any inbox row is still in flight — the only condition under which the
 *  provider keeps polling (ADR-0073 D-5). */
export function hasPending(items: readonly SuggestionOutcome[]): boolean {
  return items.some((item) => item.status === 'pending')
}

/**
 * The resolved outcomes that should toast: those whose id is being watched (or
 * was discovered on boot still pending), that have left `pending`, and that the
 * user has not already acknowledged. The server inbox is the source of truth —
 * `acked` only suppresses a re-toast of an already-seen outcome.
 */
export function selectPendingToasts(
  items: readonly SuggestionOutcome[],
  watched: ReadonlySet<string>,
  acked: ReadonlySet<string>,
): readonly PendingToast[] {
  const toasts: PendingToast[] = []
  for (const item of items) {
    const isResolved = item.status === 'completed' || item.status === 'failed'
    const isTracked = watched.has(item.id)
    const isUnacked = !acked.has(item.id)
    const shouldToast = isResolved && isTracked && isUnacked
    if (!shouldToast) continue
    toasts.push({
      id: item.id,
      status: item.status === 'completed' ? 'completed' : 'failed',
      symbol: item.symbol,
      failureReason: item.failureReason,
    })
  }
  return toasts
}

/**
 * Human-readable toast copy for a failed outcome's reason. The server's
 * `recovery-uncertain` sentinel (ADR-0073 D-3) reads as a contact-support line;
 * everything else falls back to a generic retry hint. Never the "check your
 * connection" copy — a failed outcome is not a connectivity problem (the accept
 * POST already succeeded).
 */
export function mapFailureReason(reason: string | null): string {
  if (reason === 'recovery-uncertain') {
    return 'We could not confirm the result. Contact support before retrying.'
  }
  // Actionable: a plain "try again" misleads here — retrying without funding the
  // agent wallet fails the same way.
  if (reason === 'InsufficientAgentBalance') {
    return 'Your agent wallet did not cover the fee. Top it up and try again.'
  }
  return 'The agent could not complete your request. You can try again.'
}
