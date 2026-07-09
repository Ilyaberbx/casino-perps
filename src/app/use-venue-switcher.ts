import { useCallback } from 'react'
import { useVenueSelection } from './use-venue-selection'
import { VENUES, isVenueId } from './venues'
import type { UseVenueSwitcherReturn } from './venue-switcher.types'

export function useVenueSwitcher(): UseVenueSwitcherReturn {
  const { venueId, selectVenue } = useVenueSelection()

  const onSelect = useCallback(
    (value: string) => {
      if (!isVenueId(value)) return
      selectVenue(value)
    },
    [selectVenue],
  )

  return { venueId, venues: VENUES, onSelect }
}
