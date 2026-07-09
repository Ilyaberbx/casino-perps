import type { ReactNode } from 'react'
import type { VenueOnboarding } from '../../domain'

export interface VenueOnboardingProviderProps {
  readonly value: VenueOnboarding | null
  readonly children: ReactNode
}

export type VenueOnboardingContextValue = VenueOnboarding | null
