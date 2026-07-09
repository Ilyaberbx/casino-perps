import type {
  SeenState,
  VenueOnboardingSeenStore,
} from '../../services/venue-onboarding-seen-store'

export const DEFAULT_SEEN_STATE: SeenState = {
  hasSeenOnboarding: false,
  hasSeenMigrationNotice: false,
}

export function readSeenState(
  store: VenueOnboardingSeenStore,
  privyId: string | null,
  venueId: string | null,
): SeenState {
  if (privyId === null || venueId === null) return DEFAULT_SEEN_STATE
  const loaded = store.load(privyId, venueId)
  return loaded.isOk() ? loaded.value : DEFAULT_SEEN_STATE
}
