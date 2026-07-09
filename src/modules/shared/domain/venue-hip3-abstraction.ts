import type { FC, ReactNode } from 'react'
import type { ResultAsync } from 'neverthrow'

/**
 * Venue-agnostic reasons an "enable HIP-3 trading" action can fail. A small
 * generic union (not venue-specific): the venue maps its own gateway/SDK error
 * kinds onto these so the shared gate button can render copy without importing
 * any venue module. Mirrors the shape of the onboarding step-error reasons but
 * far narrower — the enable action is a single master-wallet signature.
 */
export type Hip3AbstractionErrorReason =
  | 'wallet-rejected'
  | 'chain-mismatch'
  | 'signing-unavailable'
  | 'deposit-required'
  | 'rate-limited'
  | 'unknown'

export class Hip3AbstractionError extends Error {
  readonly reason: Hip3AbstractionErrorReason
  constructor(reason: Hip3AbstractionErrorReason, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'Hip3AbstractionError'
    this.reason = reason
  }
}

/**
 * Opaque, venue-agnostic HIP-3-abstraction state surfaced by the port.
 *
 * Some venues (Hyperliquid) run builder-deployed "HIP-3" perp markets whose
 * collateral lives in a separate, isolated pool per market DEX. A DEFAULT
 * (segregated) account cannot trade those markets until it opts into the
 * venue's cross-DEX collateral abstraction — otherwise the venue rejects the
 * order with "insufficient margin" even when the main account is funded.
 * Unified / portfolio-margin accounts already abstract collateral, so they
 * report `enabled` from the start.
 *
 * - `checking` — the initial abstraction-mode read has not settled yet.
 * - `enabled` — abstraction is active (or the account is unified/portfolio
 *   margin); HIP-3 markets are tradeable. Nothing to gate.
 * - `disabled` — a default account without abstraction; opening a HIP-3
 *   position needs one master-wallet signature first.
 * - `enabling` — the enable signature is in flight.
 * - `{ kind: 'error', reason }` — the enable action failed; the gate offers a
 *   retry.
 */
export type Hip3AbstractionStatus =
  | 'checking'
  | 'enabled'
  | 'disabled'
  | 'enabling'
  | { readonly kind: 'error'; readonly reason: Hip3AbstractionErrorReason }

export interface Hip3AbstractionState {
  readonly status: Hip3AbstractionStatus
  /**
   * Opt the account into cross-DEX collateral abstraction so HIP-3 markets
   * become tradeable, via one master-wallet signature. Optimistic on success:
   * flips `status` to `enabled`. Only meaningful when `status === 'disabled'`
   * or an `error` state; a no-op that resolves `ok` otherwise.
   */
  enable(): ResultAsync<void, Hip3AbstractionError>
}

/**
 * Hook-shaped HIP-3-abstraction capability. Sits on `Venue` (not in
 * `VenueCapabilities`) because the live value is React-bound: the state is
 * composed from React provider state inside the venue module — the enable
 * action is a master-wallet signature — so consumers reach it through a hook.
 * `app/` mounts `<provider>` once per venue and bridges the hook value into the
 * generic `hip3-abstraction-provider` context that the shared
 * `<Hip3AbstractionGateButton>` reads. Venues without HIP-3 markets omit the
 * slot; the gate then always passes through.
 */
export interface VenueHip3AbstractionCapability {
  readonly provider: FC<{ children: ReactNode }>
  useHip3Abstraction(): Hip3AbstractionState
}
