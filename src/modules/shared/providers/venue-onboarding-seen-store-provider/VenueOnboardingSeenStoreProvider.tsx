import { useCallback, useMemo, useState } from 'react'
import { VenueOnboardingSeenStoreContext } from './venue-onboarding-seen-store-provider.context'
import { readSeenState } from './venue-onboarding-seen-store-provider.utils'
import type {
  VenueOnboardingSeenStoreContextValue,
  VenueOnboardingSeenStoreProviderProps,
} from './venue-onboarding-seen-store-provider.types'
import type { SeenState } from '../../services/venue-onboarding-seen-store'

/**
 * Holds the per-(privyId, venueId) seen-state in React state, reading it from
 * the injected `VenueOnboardingSeenStore` and writing through it on mark
 * callbacks. The provider is mounted by `app/` (AccountSessionRoot) which
 * bridges the Privy DID — `shared/` cannot import `account/`.
 *
 * State is keyed by `${privyId}:${venueId}`; when the key changes we re-read
 * from storage during render (no effect needed; pattern follows React's docs
 * on "adjusting state during render").
 */
export function VenueOnboardingSeenStoreProvider({
  children,
  privyId,
  venueId,
  store,
}: VenueOnboardingSeenStoreProviderProps) {
  const scopeKey = `${privyId ?? ''}::${venueId ?? ''}`

  const [trackedScope, setTrackedScope] = useState(scopeKey)
  const [state, setState] = useState<SeenState>(() => readSeenState(store, privyId, venueId))

  if (trackedScope !== scopeKey) {
    setTrackedScope(scopeKey)
    setState(readSeenState(store, privyId, venueId))
  }

  const isScoped = privyId !== null && venueId !== null

  const markMigrationDismissed = useCallback(() => {
    if (!isScoped) return
    const result = store.markMigrationDismissed(privyId, venueId)
    if (result.isErr()) return
    setState((prev) => ({ ...prev, hasSeenMigrationNotice: true }))
  }, [isScoped, privyId, venueId, store])

  const markAutoOpened = useCallback(() => {
    if (!isScoped) return
    const result = store.markAutoOpened(privyId, venueId)
    if (result.isErr()) return
    setState((prev) => ({ ...prev, hasSeenOnboarding: true }))
  }, [isScoped, privyId, venueId, store])

  const value = useMemo<VenueOnboardingSeenStoreContextValue>(
    () => ({
      privyId,
      venueId,
      state,
      store,
      markMigrationDismissed,
      markAutoOpened,
    }),
    [privyId, venueId, state, store, markMigrationDismissed, markAutoOpened],
  )

  return (
    <VenueOnboardingSeenStoreContext.Provider value={value}>
      {children}
    </VenueOnboardingSeenStoreContext.Provider>
  )
}
