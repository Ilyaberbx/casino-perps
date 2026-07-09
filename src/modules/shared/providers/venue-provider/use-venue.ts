import { useContext } from 'react'
import { VenueContext } from './venue-provider.context'
import type { Venue } from '../../domain/venue'

export function useVenue(): Venue {
  const venue = useContext(VenueContext)
  if (!venue) throw new Error('useVenue must be used within VenueProvider')
  return venue
}
