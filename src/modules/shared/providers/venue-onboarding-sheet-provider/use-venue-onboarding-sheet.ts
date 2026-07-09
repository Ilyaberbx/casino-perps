import { useContext } from 'react'
import { VenueOnboardingSheetContext } from './venue-onboarding-sheet-provider.context'
import type { VenueOnboardingSheetContextValue } from './venue-onboarding-sheet-provider.types'

export function useVenueOnboardingSheet(): VenueOnboardingSheetContextValue {
  const ctx = useContext(VenueOnboardingSheetContext)
  if (!ctx) {
    throw new Error(
      'useVenueOnboardingSheet must be used inside <VenueOnboardingSheetProvider>',
    )
  }
  return ctx
}
