import type { ReactNode } from 'react'
import type {
  SeenState,
  VenueOnboardingSeenStore,
} from '../../services/venue-onboarding-seen-store'

export interface VenueOnboardingSeenStoreContextValue {
  /** The Privy DID of the active session, or `null` when not signed in. */
  readonly privyId: string | null
  /** The venue id whose state the consumer should read/write against. */
  readonly venueId: string | null
  /** Current state for (privyId, venueId), refreshed on mark calls. */
  readonly state: SeenState
  /** Underlying store; consumers usually go through the convenience methods. */
  readonly store: VenueOnboardingSeenStore
  markMigrationDismissed(): void
  markAutoOpened(): void
}

export interface VenueOnboardingSeenStoreProviderProps {
  readonly children: ReactNode
  readonly privyId: string | null
  readonly venueId: string | null
  readonly store: VenueOnboardingSeenStore
}
