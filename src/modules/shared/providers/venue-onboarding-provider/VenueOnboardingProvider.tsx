import { VenueOnboardingContext } from './venue-onboarding-provider.context'
import type { VenueOnboardingProviderProps } from './venue-onboarding-provider.types'

/**
 * Bridges the active venue's onboarding hook into a context-shaped
 * `VenueOnboarding | null`. Mounted by `app/`; the value is resolved upstream
 * by calling `venue.onboarding.useVenueOnboarding()` and passing it in.
 *
 * Pure pass-through — no state of its own. See ADR-0026.
 */
export function VenueOnboardingProvider({ value, children }: VenueOnboardingProviderProps) {
  return (
    <VenueOnboardingContext.Provider value={value}>
      {children}
    </VenueOnboardingContext.Provider>
  )
}
