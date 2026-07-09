import { useMemo, useState } from 'react'
import type { Logger } from '@/modules/shared/logger'
import { defaultNewDepositId } from './deposit-flow.utils'

export interface DepositId {
  /** The current per-attempt correlation id. */
  readonly depositId: string
  /** Logger child bound to `{ module, depositId }` — rebuilt when the id changes. */
  readonly log: Logger
  /** Bumped to re-run the pre-flight (retry / post chain-switch). */
  readonly preflightNonce: number
  /** Re-run pre-flight under the SAME deposit id (post chain-switch). */
  bumpPreflight(): void
  /** Start a fresh attempt: mint a new id AND re-run pre-flight under it. */
  startNewAttempt(): void
}

/**
 * Owns the per-attempt correlation-id lifecycle (`depositId`), the `log` child
 * memo bound to it, and the `preflightNonce` that drives pre-flight re-runs.
 *
 * One id threads a whole journey (`checking → … → credited | error`) so it is
 * greppable as a unit. `startNewAttempt()` mints a fresh id then bumps the
 * nonce; because the nonce-keyed pre-flight effect re-runs only after the new
 * id commits, the retried attempt's records carry the NEW id, not the stale one.
 */
export function useDepositId(
  logger: Logger,
  newDepositId: () => string = defaultNewDepositId,
): DepositId {
  const [depositId, setDepositId] = useState(newDepositId)
  const [preflightNonce, setPreflightNonce] = useState(0)
  const log = useMemo(
    () => logger.child({ module: 'hyperliquid-deposit-flow', depositId }),
    [logger, depositId],
  )

  const bumpPreflight = (): void => setPreflightNonce((n) => n + 1)
  const startNewAttempt = (): void => {
    setDepositId(newDepositId())
    setPreflightNonce((n) => n + 1)
  }

  return { depositId, log, preflightNonce, bumpPreflight, startNewAttempt }
}
