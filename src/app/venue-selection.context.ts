import { createContext } from 'react'
import type { VenueSelectionContextValue } from './venues.types'

export const VenueSelectionContext = createContext<VenueSelectionContextValue | null>(null)
