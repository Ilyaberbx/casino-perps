import { VenueHip3AbstractionContext } from './venue-hip3-abstraction-provider.context'
import type { VenueHip3AbstractionProviderProps } from './venue-hip3-abstraction-provider.types'

/**
 * Bridges the active venue's HIP-3 abstraction hook value into a context-shaped
 * `Hip3AbstractionState | null`. Mounted by `app/`; the value is resolved
 * upstream by calling `venue.hip3Abstraction.useHip3Abstraction()` and passing
 * it in. Pure pass-through — no state of its own. Mirrors
 * `VenueOnboardingProvider` (ADR-0026 / ADR-0081).
 */
export function VenueHip3AbstractionProvider({
  value,
  children,
}: VenueHip3AbstractionProviderProps) {
  return (
    <VenueHip3AbstractionContext.Provider value={value}>
      {children}
    </VenueHip3AbstractionContext.Provider>
  )
}
