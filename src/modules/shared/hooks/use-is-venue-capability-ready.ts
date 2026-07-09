import type { VenueOnboardingStepCapability } from '../domain'
import { useVenue } from '../providers/venue-provider'

/**
 * Predicate gate for surfaces that require a specific onboarding capability
 * (e.g. `sign-actions` for Cancel/Close buttons). Returns `true` when:
 * - the active venue has no `onboarding` slot (capability is implicitly
 *   ready — venues without an onboarding flow do not gate trading), or
 * - any onboarding step exposes the requested capability with status
 *   `'complete'`.
 *
 * See ADR-0026 (VenueOnboarding port) and ADR-0001 (venue switching hard-
 * remounts, which makes `venue.onboarding` presence stable for the lifetime
 * of every mounted consumer — the conditional `useVenueOnboarding()` call
 * below is safe under that contract).
 */
export function useIsVenueCapabilityReady(
  capability: VenueOnboardingStepCapability,
): boolean {
  const venue = useVenue()
  if (!venue.onboarding) return true
  const onboarding = venue.onboarding.useVenueOnboarding()
  return onboarding.steps.some(
    (step) => step.capability === capability && step.status === 'complete',
  )
}
