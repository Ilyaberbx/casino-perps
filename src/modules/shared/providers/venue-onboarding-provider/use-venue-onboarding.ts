import { useContext } from 'react'
import {
  VENUE_ONBOARDING_UNSET,
  VenueOnboardingContext,
} from './venue-onboarding-provider.context'
import type { VenueOnboardingContextValue } from './venue-onboarding-provider.types'

/**
 * Returns the active venue's onboarding value, or `null` if the active venue
 * has no onboarding flow. Throws if called outside `<VenueOnboardingProvider>`.
 */
export function useVenueOnboarding(): VenueOnboardingContextValue {
  const slot = useContext(VenueOnboardingContext)
  if (slot === VENUE_ONBOARDING_UNSET) {
    throw new Error('useVenueOnboarding must be used inside <VenueOnboardingProvider>')
  }
  // Narrowing past the unique-symbol sentinel: TS can't drop the symbol from
  // the union, so we cast — the runtime guard above guarantees the variant.
  return slot as VenueOnboardingContextValue
}
