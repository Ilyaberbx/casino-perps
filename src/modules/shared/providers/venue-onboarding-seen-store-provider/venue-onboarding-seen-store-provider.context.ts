import { createContext } from 'react'
import type { VenueOnboardingSeenStoreContextValue } from './venue-onboarding-seen-store-provider.types'

const UNSET = Symbol('venue-onboarding-seen-store-context-unset')

export type VenueOnboardingSeenStoreContextSlot =
  | VenueOnboardingSeenStoreContextValue
  | typeof UNSET

export const VENUE_ONBOARDING_SEEN_STORE_UNSET = UNSET

export const VenueOnboardingSeenStoreContext =
  createContext<VenueOnboardingSeenStoreContextSlot>(UNSET)
