import { VenueContext } from './venue-provider.context'
import type { VenueProviderProps } from './venue-provider.types'

export function VenueProvider({ venue, children }: VenueProviderProps) {
  return (
    <VenueContext.Provider value={venue}>
      {children}
    </VenueContext.Provider>
  )
}
