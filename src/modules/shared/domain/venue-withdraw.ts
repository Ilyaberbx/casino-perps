import type { FC, ReactNode } from 'react'

/**
 * Opaque, venue-agnostic withdraw state surfaced by the withdraw port. Mirrors
 * `TransferState` and `DepositState` (the transfer / deposit ports): the shared
 * layer models nothing about *how* a venue moves funds out of itself; the venue
 * owns its own withdraw body and state machine. For Hyperliquid the withdraw is
 * a `withdraw3` action that moves USDC from the perp account to an L1/Arbitrum
 * address — master-wallet-signed (ADR-0012), optimistic on `status:ok`, flat-fee
 * on L1. Two facts the host needs: whether the affordance is `isApplicable` at
 * all for the active account/venue, and whether the flow has reached a terminal
 * "done" moment. Everything venue-specific lives behind the body the venue
 * renders (Option A).
 */
export interface WithdrawState {
  /**
   * `true` when an in-app withdraw makes sense for the active account/venue —
   * drives both the trigger (renders nothing when false) and the sheet (never
   * opens when false). Venues with no in-app withdraw omit the slot entirely;
   * this flag gates the cases where the slot is present but withdraw is not yet
   * meaningful for the current account state.
   */
  readonly isApplicable: boolean
  /**
   * `true` once the venue considers the withdrawal broadcast complete. The HL
   * flow is optimistic-on-`status:ok` and closes the sheet, so this is mostly a
   * courtesy signal; the venue body owns every intermediate state itself.
   */
  readonly isComplete: boolean
}

/**
 * Hook-shaped withdraw capability, a sibling of `VenueTransferCapability` and
 * `VenueDepositCapability`. Sits on `Venue` (not in `VenueCapabilities`) because
 * the live value is React-bound: the `WithdrawState` is composed from React
 * provider state inside the venue module, so consumers reach it through a hook
 * rather than a pre-built object. The generic host mounts `<provider>` once and
 * renders the venue's own body; capability-presence narrowing happens on
 * `venue.withdraw`, and the `isApplicable` narrowing on
 * `useWithdraw().isApplicable`. Venues without an in-app withdraw flow omit the
 * slot, so no withdraw affordance renders.
 */
export interface VenueWithdrawCapability {
  readonly provider: FC<{ children: ReactNode }>
  /**
   * The venue's own withdraw body. Option A: the venue draws every state of its
   * withdraw flow itself (destination/amount, fee notice, success/error). The
   * generic host mounts `provider` and renders `body` inside it — it never knows
   * what the body contains. Venue-agnostic by construction.
   */
  readonly body: FC
  useWithdraw(): WithdrawState
}
