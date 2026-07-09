import { useCallback, useState } from 'react'
import { useVenueOnboarding } from '../../providers/venue-onboarding-provider'
import { useVenueOnboardingSheet } from '../../providers/venue-onboarding-sheet-provider'
import type {
  VenueOnboardingBannerProps,
  VenueOnboardingBannerState,
} from './venue-onboarding-banner.types'

const HIDDEN: VenueOnboardingBannerState = { kind: 'hidden' }

export function useVenueOnboardingBanner({
  isWalletConnected,
}: VenueOnboardingBannerProps): VenueOnboardingBannerState {
  const onboarding = useVenueOnboarding()
  const sheet = useVenueOnboardingSheet()

  // Session dismiss: the close (X) hides the banner until reload. Reset when the
  // active venue changes so dismissing one venue's banner never suppresses
  // another's. Render-time previous-value tracker (React 19 idiom; the compiler
  // forbids setState in an effect — mirrors use-leverage-margin-state).
  const venueLabel = onboarding?.venueLabel ?? null
  const [dismissed, setDismissed] = useState(false)
  const [previousVenueLabel, setPreviousVenueLabel] = useState(venueLabel)
  const hasVenueChanged = previousVenueLabel !== venueLabel
  if (hasVenueChanged) {
    setPreviousVenueLabel(venueLabel)
    setDismissed(false)
  }
  const onDismiss = useCallback(() => setDismissed(true), [])

  if (!isWalletConnected) return HIDDEN
  if (!onboarding) return HIDDEN
  if (dismissed) return HIDDEN

  const isBootstrapping = onboarding.status === 'bootstrapping'
  const isReady = onboarding.status === 'ready'

  if (isBootstrapping || isReady) return HIDDEN

  const totalSteps = onboarding.steps.length
  const completedSteps = onboarding.steps.filter((step) => step.status === 'complete').length
  const hasRunningStep = onboarding.steps.some((step) => step.status === 'running')
  const isInFlightWithSheetClosed = hasRunningStep && !sheet.isOpen

  if (isInFlightWithSheetClosed) {
    return {
      kind: 'in-flight',
      message: `${onboarding.venueLabel} setting up…`,
      onClick: sheet.open,
      onDismiss,
    }
  }

  // Short labels (no "of N steps done" / "Continue setup") so the banner fits one
  // row on mobile — the long venue label already eats most of the width.
  return {
    kind: 'incomplete',
    message: `${onboarding.venueLabel} setup: ${completedSteps}/${totalSteps}`,
    ctaLabel: 'Continue →',
    onClick: sheet.open,
    onDismiss,
  }
}
