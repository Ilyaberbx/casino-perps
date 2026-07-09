import { createContext } from 'react'
import type { HyperliquidVenueOnboarding } from './hyperliquid-onboarding-provider.types'

// Private to the provider unit — consumers go through `useHyperliquidVenueOnboarding`.
export const HyperliquidOnboardingContext = createContext<HyperliquidVenueOnboarding | null>(
  null,
)
