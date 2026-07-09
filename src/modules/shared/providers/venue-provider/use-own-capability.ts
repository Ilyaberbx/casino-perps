import { useVenue } from './use-venue'
import type { OwnAccountCapabilities } from '../../domain/venue'

/**
 * Narrows the active `Venue`'s **Acting-Address-keyed** account group
 * (`capabilities.ownAccount`) to a single reader, or `undefined` when the venue
 * exposes no `ownAccount` group.
 *
 * The order flow (Available-to-Trade, draft validation, order preview, the
 * max-size slider, the fee estimate, the leverage/margin-mode seed) reads
 * through this accessor so it reflects the authenticated User's own account
 * even while Spectating — never the Spectated Address (ADR-0038 D-1). The
 * spectate-aware surfaces (Portfolio, account dock) keep reading the viewing
 * capabilities via `useCapabilityOptional`.
 *
 * Returns `undefined` rather than throwing because a venue may legitimately omit
 * the group; callers degrade gracefully (mirrors `useCapabilityOptional`).
 */
export function useOwnCapability<K extends keyof OwnAccountCapabilities>(
  name: K,
): OwnAccountCapabilities[K] | undefined {
  const venue = useVenue()
  return venue.capabilities.ownAccount?.[name]
}
