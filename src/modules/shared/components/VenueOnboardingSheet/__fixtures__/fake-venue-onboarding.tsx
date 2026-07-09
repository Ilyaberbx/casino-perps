import { type ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import type {
  Venue,
  VenueOnboarding,
  VenueOnboardingStatus,
  VenueOnboardingStep,
} from '../../../domain'
import { VenueProvider } from '../../../providers/venue-provider'
import { VenueOnboardingProvider } from '../../../providers/venue-onboarding-provider'
import { VenueOnboardingSheetProvider } from '../../../providers/venue-onboarding-sheet-provider'
import type { VenueOnboardingSheetActions } from '../venue-onboarding-sheet.types'

interface BuildOptions {
  readonly venueLabel?: string
  readonly status?: VenueOnboardingStatus
  readonly steps?: ReadonlyArray<VenueOnboardingStep>
  readonly runAll?: VenueOnboarding['runAll']
  readonly retryStep?: VenueOnboarding['retryStep']
}

export function buildFakeVenueOnboarding(options: BuildOptions = {}): VenueOnboarding {
  return {
    venueId: 'fake',
    venueLabel: options.venueLabel ?? 'Fake Venue',
    status: options.status ?? 'incomplete',
    steps: options.steps ?? [],
    runAll: options.runAll ?? (() => okAsync<void, never>(undefined)),
    retryStep: options.retryStep ?? (() => okAsync<void, never>(undefined)),
  }
}

interface WrapOptions {
  readonly onboarding?: VenueOnboarding | null
  readonly defaultSheetOpen?: boolean
}

export function buildFakeActions(
  overrides: Partial<VenueOnboardingSheetActions> = {},
): VenueOnboardingSheetActions {
  return {
    reconnectWallet: overrides.reconnectWallet ?? (() => {}),
    switchChain: overrides.switchChain ?? (() => {}),
    reload: overrides.reload ?? (() => {}),
    confirmReset: overrides.confirmReset ?? (() => true),
    openDeposit: overrides.openDeposit ?? (() => {}),
  }
}

export function buildFakeVenue(): Venue {
  return {
    metadata: { id: 'fake', label: 'Fake Venue' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
  }
}

export function wrapWithOnboarding({ onboarding = null, defaultSheetOpen = false }: WrapOptions) {
  const venue = buildFakeVenue()
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VenueProvider venue={venue}>
        <VenueOnboardingProvider value={onboarding}>
          <VenueOnboardingSheetProvider defaultOpen={defaultSheetOpen}>
            {children}
          </VenueOnboardingSheetProvider>
        </VenueOnboardingProvider>
      </VenueProvider>
    )
  }
}
