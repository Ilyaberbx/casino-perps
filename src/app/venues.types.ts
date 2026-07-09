import type { Venue } from '@/modules/shared/domain/venue'
import type { WalletAddress } from '@/modules/shared/domain'

export type VenueId = 'mock' | 'hyperliquid'

export interface VenueFactoryContext {
  /** The Viewing Address — `spectate ?? connected` (keys Portfolio + dock). */
  readonly getAddress: () => WalletAddress | null
  /** The Acting Address — connected-only (keys the order flow). ADR-0038. */
  readonly getActingAddress: () => WalletAddress | null
}

export interface VenueRegistryEntry {
  id: VenueId
  label: string
  create: (ctx: VenueFactoryContext) => Venue
  /**
   * The venue's live favicon URL, tried first (runtime hybrid: remote-first).
   * `null` when the venue has no domain (e.g. the Mock venue).
   */
  iconRemoteUrl: string | null
  /**
   * Bundled local asset URL, tried after the remote favicon fails. Optional —
   * when omitted (and remote is null/failed) the venue renders a monogram tile.
   */
  iconLocalSrc?: string
}

export interface VenueSelectionContextValue {
  venueId: VenueId
  selectVenue: (id: VenueId) => void
  availableVenues: ReadonlyArray<{ id: VenueId; label: string }>
}
