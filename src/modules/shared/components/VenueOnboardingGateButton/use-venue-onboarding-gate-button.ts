import { useVenueOnboarding } from '../../providers/venue-onboarding-provider'
import { useVenueOnboardingSheet } from '../../providers/venue-onboarding-sheet-provider'

interface ReadyState {
  readonly kind: 'ready'
}

interface BootstrappingState {
  readonly kind: 'bootstrapping'
}

interface IncompleteState {
  readonly kind: 'incomplete'
  readonly label: string
  readonly onClick: () => void
}

export type VenueOnboardingGateButtonState =
  | ReadyState
  | BootstrappingState
  | IncompleteState

export function useVenueOnboardingGateButton(): VenueOnboardingGateButtonState {
  const onboarding = useVenueOnboarding()
  const sheet = useVenueOnboardingSheet()

  if (!onboarding) return { kind: 'ready' }

  const isBootstrapping = onboarding.status === 'bootstrapping'
  const isReady = onboarding.status === 'ready'

  if (isReady) return { kind: 'ready' }
  if (isBootstrapping) return { kind: 'bootstrapping' }

  return {
    kind: 'incomplete',
    label: `Complete ${onboarding.venueLabel} Setup`,
    onClick: sheet.open,
  }
}
