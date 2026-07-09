import type { ResultAsync } from 'neverthrow'
import type { ActiveTwap } from './twap-active-snapshot-reader'

export type CancelTwapErrorKind = 'unknown-symbol' | 'rejected'

export class CancelTwapError extends Error {
  readonly kind: CancelTwapErrorKind
  constructor(kind: CancelTwapErrorKind, message: string) {
    super(message)
    this.name = 'CancelTwapError'
    this.kind = kind
  }
}

/**
 * Cancels running TWAP orders (ADR-0052). A distinct write concern from the
 * `Trader` placement port and from the resting-order `cancel` path — a TWAP is
 * a background-running process cancelled via the venue's dedicated `twapCancel`
 * action. Mirrors how `positionProtection` separates background write concerns
 * into their own port. Optional capability — an absent slot hides the per-row
 * Cancel button and the bulk Cancel(N) affordance (wallet-gate mode-3
 * absent-affordance idiom).
 */
export interface TwapController {
  /** Cancel a single active TWAP by its snapshot row. */
  cancelTwap(twap: ActiveTwap): ResultAsync<void, CancelTwapError>
  /** Cancel every supplied active TWAP, collecting errors without
   *  short-circuiting; resolves to the list of failures (empty ⇒ all cancelled). */
  cancelAll(twaps: ReadonlyArray<ActiveTwap>): ResultAsync<ReadonlyArray<CancelTwapError>, never>
}
