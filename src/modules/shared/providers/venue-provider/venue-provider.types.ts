import type { ReactNode } from 'react'
import type { Venue } from '../../domain/venue'

export interface VenueProviderProps {
  venue: Venue
  children: ReactNode
}
