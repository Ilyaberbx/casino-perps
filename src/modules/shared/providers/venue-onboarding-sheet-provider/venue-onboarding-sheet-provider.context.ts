import { createContext } from 'react'
import type { VenueOnboardingSheetContextValue } from './venue-onboarding-sheet-provider.types'

export const VenueOnboardingSheetContext =
  createContext<VenueOnboardingSheetContextValue | null>(null)
