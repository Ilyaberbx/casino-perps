import type { FC, ReactNode } from 'react'

/**
 * Opaque, venue-agnostic deposit state surfaced by the deposit port. The shared
 * layer deliberately models **nothing** about how a venue funds an account: the
 * venue owns its own deposit body and its own state machine (e.g. Hyperliquid's
 * `checking → needs-funding | wrong-chain | no-gas | ready → signing → sent →
 * credited`). The host only needs to know whether the flow has reached a
 * terminal "done" moment so it can offer a close/"Start trading" affordance and
 * announce completion. Everything venue-specific lives behind the body the
 * venue renders, not in this port (Option A; see the deposit ADRs / PRD).
 */
export interface DepositState {
  /**
   * `true` once the venue considers the deposit complete (funds usable on the
   * venue). Drives the host's terminal affordance; the venue body owns every
   * intermediate state itself.
   */
  readonly isComplete: boolean
}

/**
 * Hook-shaped deposit capability, a sibling of `VenueOnboardingCapability`. Sits
 * on `Venue` (not in `VenueCapabilities`) because the live value is React-bound:
 * the `DepositState` is composed from React provider state inside the venue
 * module, so consumers reach it through a hook rather than a pre-built object.
 * The generic host mounts `<provider>` once and renders the venue's own body;
 * capability-presence narrowing happens on `venue.deposit`. Venues without an
 * in-app deposit flow omit the slot, so no deposit affordance renders.
 */
export interface VenueDepositCapability {
  readonly provider: FC<{ children: ReactNode }>
  /**
   * The venue's own deposit body. Option A: the venue draws every state of its
   * deposit flow itself (e.g. Hyperliquid's QR / amount / sent / credited
   * tracks). The generic host mounts `provider` and renders `body` inside it —
   * it never knows what the body contains. Venue-agnostic by construction: the
   * host treats this as an opaque surface.
   */
  readonly body: FC
  useDeposit(): DepositState
}
