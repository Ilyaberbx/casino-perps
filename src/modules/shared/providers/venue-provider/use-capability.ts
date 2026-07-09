import { useVenue } from './use-venue'
import type { VenueCapabilities } from '../../domain/venue'

/**
 * Narrows the active `Venue` to a single **required** capability slot, returning
 * the implementing reader. Throws the one canonical
 * `venue is missing required capability: <name>` error when the venue does not
 * implement it.
 *
 * The error wording lives here once, so feature hooks no longer hand-write it
 * per call-site. Use this for capabilities a feature cannot function without
 * (e.g. `marketData`, `trader`, `candles`); for tiles/panels that render an
 * "unsupported" state when a slot is absent, use `useCapabilityOptional`.
 */
export function useCapability<K extends keyof VenueCapabilities>(
  name: K,
): NonNullable<VenueCapabilities[K]> {
  const venue = useVenue()
  const capability = venue.capabilities[name]
  if (!capability) throw new Error(`venue is missing required capability: ${name}`)
  return capability
}
