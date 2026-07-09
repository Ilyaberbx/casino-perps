import type { FC, ReactNode } from 'react'

/**
 * Opaque, venue-agnostic transfer state surfaced by the transfer port. Mirrors
 * `DepositState` (the deposit port — ADR-0028): the shared layer models nothing
 * about *how* a venue moves funds between sub-accounts; the venue owns its own
 * transfer body and state machine. Two facts the host needs: whether the
 * affordance is `isApplicable` at all (Transfer is meaningless on a unified /
 * portfolio-margin account — only segregated Spot/Perp accounts can transfer),
 * and whether the flow has reached a terminal "done" moment. Everything
 * venue-specific lives behind the body the venue renders. See ADR-0033 D-1.
 */
export interface TransferState {
  /**
   * `true` when an in-app Spot↔Perp transfer makes sense for the active account
   * — i.e. the account keeps Spot and Perp segregated. Drives both the trigger
   * (renders nothing when false) and the sheet (never opens when false). For
   * Hyperliquid this is the `accountMode` capability's `isSegregated`.
   */
  readonly isApplicable: boolean
  /**
   * `true` once the venue considers the transfer complete (funds moved). The
   * HL flow is optimistic-on-`status:ok` and closes the sheet, so this is mostly
   * a courtesy signal; the venue body owns every intermediate state itself.
   */
  readonly isComplete: boolean
}

/**
 * Hook-shaped transfer capability, a sibling of `VenueDepositCapability`. Sits
 * on `Venue` (not in `VenueCapabilities`) because the live value is React-bound:
 * the `TransferState` is composed from React provider state inside the venue
 * module, so consumers reach it through a hook rather than a pre-built object.
 * The generic host mounts `<provider>` once and renders the venue's own body;
 * capability-presence narrowing happens on `venue.transfer`, and the `isApplicable`
 * narrowing on `useTransfer().isApplicable`. Venues without an in-app transfer
 * flow omit the slot, so no transfer affordance renders. See ADR-0033 D-1.
 */
export interface VenueTransferCapability {
  readonly provider: FC<{ children: ReactNode }>
  /**
   * The venue's own transfer body. Option A: the venue draws every state of its
   * transfer flow itself (From/To selectors, amount, success/error). The generic
   * host mounts `provider` and renders `body` inside it — it never knows what the
   * body contains. Venue-agnostic by construction.
   */
  readonly body: FC
  useTransfer(): TransferState
}
