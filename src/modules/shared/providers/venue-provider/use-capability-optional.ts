import { useVenue } from './use-venue'
import type { VenueCapabilities } from '../../domain/venue'

/**
 * Non-throwing variant of `useCapability`. Returns the implementing reader when
 * the active `Venue` supports the slot, or `undefined` when it does not.
 *
 * Use this for tiles/panels that gracefully degrade to an "unsupported" state
 * when a venue omits a capability (e.g. the portfolio tab panels). A venue is
 * still required to be mounted — only the capability is optional. Feature code
 * that cannot function without the capability must use `useCapability`.
 */
export function useCapabilityOptional<K extends keyof VenueCapabilities>(
  name: K,
): NonNullable<VenueCapabilities[K]> | undefined {
  const venue = useVenue()
  return venue.capabilities[name] ?? undefined
}
