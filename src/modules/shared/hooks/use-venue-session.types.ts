import type { Venue } from '../domain/venue'
import type { Logger } from '../logger'
import type { ConnectionRecoveryContextValue } from '../providers/connection-recovery'

/**
 * Inputs to `useVenueSession`. The hook owns the venue lifecycle but stays
 * inside `shared/` — so the app-level seams (which venues exist, the configured
 * logger) are injected rather than imported, which also makes the
 * timing-sensitive paths testable with fake timers.
 *
 * Address mirroring is NOT an input here — it moved to
 * `app/selected-wallet-bridge.tsx`, which writes the Selected Wallet into the
 * address holder and refreshes the venue. See `use-venue-session.ts`.
 *
 * Generic over the venue-id type so the composition root keeps its narrow union
 * (e.g. `'mock' | 'hyperliquid'`) end to end.
 */
export interface VenueSessionOptions<TVenueId extends string = string> {
  /** The currently-selected venue id. A change rebuilds the venue. */
  readonly venueId: TVenueId
  /** Constructs a fresh venue for an id (composition root closes over the registry). */
  readonly createVenue: (venueId: TVenueId) => Venue
  /** Configured logger singleton (injected — `shared/` may not import `app/`). */
  readonly logger: Logger
  /** Injectable for tests; defaults to the global `setTimeout`. */
  readonly setTimeout?: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  /** Injectable for tests; defaults to the global `clearTimeout`. */
  readonly clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
}

export interface VenueSession {
  /** The active venue. Identity changes only on venueId switch or reconnect. */
  readonly venue: Venue
  /** Connection-recovery context value (health snapshot + reconnect action). */
  readonly recovery: ConnectionRecoveryContextValue
}
