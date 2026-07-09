import { useContext } from 'react'
import { VenueContext } from './venue-provider.context'
import type { Venue } from '../../domain/venue'

/**
 * Non-throwing variant of `useVenue`. Returns the active `Venue` when one is
 * mounted, or `null` when there is no `VenueProvider` above this consumer.
 *
 * Use this only where the absence of a venue is a legitimate runtime state
 * (e.g. a provider that must still produce a sensible value before the venue
 * is wired, or under test harnesses that render without a `VenueProvider`).
 * Feature code that genuinely requires a venue must keep using `useVenue`.
 */
export function useVenueOptional(): Venue | null {
  return useContext(VenueContext)
}
