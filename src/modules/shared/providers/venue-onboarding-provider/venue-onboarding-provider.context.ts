import { createContext } from 'react'
import type { VenueOnboardingContextValue } from './venue-onboarding-provider.types'

const UNSET = Symbol('venue-onboarding-context-unset')

export type VenueOnboardingContextSlot =
  | VenueOnboardingContextValue
  | typeof UNSET

export const VENUE_ONBOARDING_UNSET = UNSET

export const VenueOnboardingContext = createContext<VenueOnboardingContextSlot>(UNSET)
