import { type ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import type {
  Venue,
  VenueOnboarding,
  VenueOnboardingStatus,
  VenueOnboardingStep,
  VenueOnboardingStepCapability,
  VenueOnboardingStepStatus,
} from '../../domain'
import { VenueProvider } from '../../providers/venue-provider'

interface MakeStepOptions {
  readonly id?: string
  readonly status?: VenueOnboardingStepStatus
  readonly capability?: VenueOnboardingStepCapability
}

export function makeOnboardingStep(options: MakeStepOptions = {}): VenueOnboardingStep {
  return {
    id: options.id ?? 'step',
    label: 'Step',
    description: 'A step',
    status: options.status ?? 'pending',
    capability: options.capability,
  }
}

interface MakeOnboardingOptions {
  readonly venueId?: string
  readonly venueLabel?: string
  readonly status?: VenueOnboardingStatus
  readonly steps?: ReadonlyArray<VenueOnboardingStep>
}

export function makeVenueOnboarding(options: MakeOnboardingOptions = {}): VenueOnboarding {
  return {
    venueId: options.venueId ?? 'synthetic',
    venueLabel: options.venueLabel ?? 'Synthetic',
    status: options.status ?? 'incomplete',
    steps: options.steps ?? [],
    runAll: () => okAsync<void, never>(undefined),
    retryStep: () => okAsync<void, never>(undefined),
  }
}

interface MakeVenueOptions {
  readonly onboarding?: VenueOnboarding | null
  readonly id?: string
  readonly label?: string
}

/**
 * Builds a synthetic `Venue` with a stub `connection` capability. When
 * `onboarding` is supplied the venue exposes an `onboarding` slot whose
 * `useVenueOnboarding` hook returns the same value across renders (the
 * predicate hooks only depend on its current snapshot).
 */
export function makeSyntheticVenue(options: MakeVenueOptions = {}): Venue {
  const onboarding = options.onboarding
  const venue: Venue = {
    metadata: { id: options.id ?? 'synthetic', label: options.label ?? 'Synthetic' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
    onboarding: onboarding
      ? {
          provider: ({ children }) => <>{children}</>,
          useVenueOnboarding: () => onboarding,
        }
      : undefined,
  }
  return venue
}

export function wrapWithVenue(venue: Venue) {
  return function VenueWrapper({ children }: { children: ReactNode }) {
    return <VenueProvider venue={venue}>{children}</VenueProvider>
  }
}
