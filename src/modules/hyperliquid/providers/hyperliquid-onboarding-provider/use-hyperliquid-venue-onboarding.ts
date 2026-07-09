import { useContext } from 'react'
import { HyperliquidOnboardingContext } from './hyperliquid-onboarding-provider.context'
import type { HyperliquidVenueOnboarding } from './hyperliquid-onboarding-provider.types'

/**
 * Consumer hook for the Hyperliquid onboarding state. Returns a value that
 * satisfies the venue-agnostic `VenueOnboarding` port — wired into the generic
 * `<VenueOnboardingProvider>` by `app/`. See ADR-0026.
 */
export function useHyperliquidVenueOnboarding(): HyperliquidVenueOnboarding {
  const ctx = useContext(HyperliquidOnboardingContext)
  if (!ctx) {
    throw new Error(
      'useHyperliquidVenueOnboarding must be used inside <HyperliquidOnboardingProvider>',
    )
  }
  return ctx
}
