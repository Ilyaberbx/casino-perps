import { useVenue } from '../providers/venue-provider'

/**
 * Predicate gate for the Place-Order submit button. Returns `true` when:
 * - the active venue has no `onboarding` slot (no gating required), or
 * - the onboarding status is `'ready'` (all required steps complete).
 *
 * See ADR-0026 (VenueOnboarding port) and ADR-0001 (venue switching hard-
 * remounts, which makes the conditional `useVenueOnboarding()` call safe —
 * `venue.onboarding` presence is stable per mount).
 */
export function useIsVenueOnboardingReady(): boolean {
  const venue = useVenue()
  if (!venue.onboarding) return true
  const onboarding = venue.onboarding.useVenueOnboarding()
  return onboarding.status === 'ready'
}
