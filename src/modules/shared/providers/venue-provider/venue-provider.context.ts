import { createContext } from 'react'
import type { Venue } from '../../domain/venue'

export const VenueContext = createContext<Venue | null>(null)
