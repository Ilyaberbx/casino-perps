import { useContext } from 'react'
import {
  VENUE_ONBOARDING_SEEN_STORE_UNSET,
  VenueOnboardingSeenStoreContext,
} from './venue-onboarding-seen-store-provider.context'
import type { VenueOnboardingSeenStoreContextValue } from './venue-onboarding-seen-store-provider.types'

/**
 * Same as `useVenueOnboardingSeenStore` but returns `null` when the provider
 * is absent — for consumers that want to degrade gracefully when mounted
 * outside an `AccountSession` (e.g. component tests).
 */
export function useVenueOnboardingSeenStoreOptional():
  | VenueOnboardingSeenStoreContextValue
  | null {
  const slot = useContext(VenueOnboardingSeenStoreContext)
  if (slot === VENUE_ONBOARDING_SEEN_STORE_UNSET) return null
  return slot as VenueOnboardingSeenStoreContextValue
}
