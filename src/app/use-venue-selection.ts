import { useContext } from 'react'
import { VenueSelectionContext } from './venue-selection.context'
import type { VenueSelectionContextValue } from './venues.types'

export function useVenueSelection(): VenueSelectionContextValue {
  const value = useContext(VenueSelectionContext)
  if (!value) throw new Error('useVenueSelection must be used inside <VenueSelectionContext.Provider>')
  return value
}
