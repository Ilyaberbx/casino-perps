import { useContext } from 'react'
import {
  VENUE_ONBOARDING_SEEN_STORE_UNSET,
  VenueOnboardingSeenStoreContext,
} from './venue-onboarding-seen-store-provider.context'
import type { VenueOnboardingSeenStoreContextValue } from './venue-onboarding-seen-store-provider.types'

/**
 * Returns the current seen-state for the active (privyId, venueId) pair plus
 * mark callbacks. Throws if called outside `<VenueOnboardingSeenStoreProvider>`.
 */
export function useVenueOnboardingSeenStore(): VenueOnboardingSeenStoreContextValue {
  const slot = useContext(VenueOnboardingSeenStoreContext)
  if (slot === VENUE_ONBOARDING_SEEN_STORE_UNSET) {
    throw new Error(
      'useVenueOnboardingSeenStore must be used inside <VenueOnboardingSeenStoreProvider>',
    )
  }
  return slot as VenueOnboardingSeenStoreContextValue
}
