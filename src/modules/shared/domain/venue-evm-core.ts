import type { FC, ReactNode } from 'react'

/**
 * Opaque, venue-agnostic EVM⇄Core state surfaced by the evm-core port. Mirrors
 * `SendState` / `WithdrawState`: the shared layer models nothing about *how* a
 * venue moves a token between its L1 spot state and its EVM chain; the venue owns
 * its own body and state machine. For Hyperliquid this is a bidirectional move
 * between **HyperCore** (the L1 spot balances) and **HyperEVM** (chain 999/998):
 * Core→EVM is a master-signed `spotSend` to the token's system address (credits
 * the user's own HyperEVM address), and EVM→Core is an on-chain HyperEVM
 * transfer to the same system address. Two facts the host needs: whether the
 * affordance is `isApplicable` at all for the active account/venue, and whether
 * the flow has reached a terminal "done" moment. Everything venue-specific lives
 * behind the body the venue renders (Option A).
 */
export interface EvmCoreState {
  /**
   * `true` when an in-app EVM⇄Core move makes sense for the active account/venue
   * — drives both the tab availability and the pane. Venues with no EVM⇄Core
   * flow omit the slot entirely; this flag gates the cases where the slot is
   * present but the move is not yet meaningful for the current account state
   * (e.g. no resolvable master wallet, or no EVM-linked tokens held).
   */
  readonly isApplicable: boolean
  /**
   * `true` once the venue considers the move broadcast complete. The HL Core→EVM
   * flow is optimistic-on-`status:ok`; EVM→Core resolves on the mined receipt.
   * The venue body owns every intermediate state itself.
   */
  readonly isComplete: boolean
}

/**
 * Hook-shaped EVM⇄Core capability, a sibling of `VenueSendCapability` and
 * `VenueWithdrawCapability`. Sits on `Venue` (not in `VenueCapabilities`)
 * because the live value is React-bound: the `EvmCoreState` is composed from
 * React provider state inside the venue module, so consumers reach it through a
 * hook rather than a pre-built object. The generic host mounts `<provider>` once
 * and renders the venue's own body; capability-presence narrowing happens on
 * `venue.evmCore`, and the `isApplicable` narrowing on `useEvmCore().isApplicable`.
 * Venues without an in-app EVM⇄Core flow omit the slot, so no affordance renders.
 */
export interface VenueEvmCoreCapability {
  readonly provider: FC<{ children: ReactNode }>
  /**
   * The venue's own EVM⇄Core body. Option A: the venue draws every state of its
   * flow itself (direction toggle, token/amount, success/error). The generic
   * host mounts `provider` and renders `body` inside it — it never knows what the
   * body contains. Venue-agnostic by construction.
   */
  readonly body: FC
  useEvmCore(): EvmCoreState
}
