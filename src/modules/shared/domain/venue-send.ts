import type { FC, ReactNode } from 'react'

/**
 * Opaque, venue-agnostic send state surfaced by the send port. Mirrors
 * `WithdrawState` (the withdraw port): the shared layer models nothing about
 * *how* a venue moves funds to an external address; the venue owns its own send
 * body and state machine. For Hyperliquid a send is one of two on-chain
 * actions that stay on Hyperliquid (no L1 bridge / no flat L1 fee): `usdSend`
 * moves perp USDC to another address, and `spotSend` moves a spot token to
 * another address. Both are user-signed actions — master-wallet-signed
 * (ADR-0012), optimistic on `status:ok`. Two facts the host needs: whether the
 * affordance is `isApplicable` at all for the active account/venue, and whether
 * the flow has reached a terminal "done" moment. Everything venue-specific
 * lives behind the body the venue renders (Option A).
 */
export interface SendState {
  /**
   * `true` when an in-app send makes sense for the active account/venue —
   * drives both the trigger (renders nothing when false) and the sheet (never
   * opens when false). Venues with no in-app send omit the slot entirely; this
   * flag gates the cases where the slot is present but send is not yet
   * meaningful for the current account state.
   */
  readonly isApplicable: boolean
  /**
   * `true` once the venue considers the send broadcast complete. The HL flow is
   * optimistic-on-`status:ok` and closes the sheet, so this is mostly a courtesy
   * signal; the venue body owns every intermediate state itself.
   */
  readonly isComplete: boolean
}

/**
 * Hook-shaped send capability, a sibling of `VenueWithdrawCapability` and
 * `VenueTransferCapability`. Sits on `Venue` (not in `VenueCapabilities`)
 * because the live value is React-bound: the `SendState` is composed from React
 * provider state inside the venue module, so consumers reach it through a hook
 * rather than a pre-built object. The generic host mounts `<provider>` once and
 * renders the venue's own body; capability-presence narrowing happens on
 * `venue.send`, and the `isApplicable` narrowing on `useSend().isApplicable`.
 * Venues without an in-app send flow omit the slot, so no send affordance
 * renders.
 */
export interface VenueSendCapability {
  readonly provider: FC<{ children: ReactNode }>
  /**
   * The venue's own send body. Option A: the venue draws every state of its send
   * flow itself (destination/asset/amount, success/error). The generic host
   * mounts `provider` and renders `body` inside it — it never knows what the
   * body contains. Venue-agnostic by construction.
   */
  readonly body: FC
  useSend(): SendState
}
