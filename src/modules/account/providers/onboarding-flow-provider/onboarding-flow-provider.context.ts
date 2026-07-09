import { createContext } from 'react'
import type { OnboardingState } from '../../hooks/use-onboarding-flow'

export const OnboardingFlowContext = createContext<OnboardingState | null>(null)
