import type { VenueRegistryEntry, VenueId } from './venues.types'

export interface UseVenueSwitcherReturn {
  venueId: VenueId
  venues: ReadonlyArray<VenueRegistryEntry>
  onSelect: (value: string) => void
}
