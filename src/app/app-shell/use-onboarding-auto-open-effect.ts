import { useEffect, useRef } from 'react'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { useVenueOnboardingSeenStoreOptional } from '@/modules/shared/providers/venue-onboarding-seen-store-provider'
import type { VenueOnboarding, VenueOnboardingStatus } from '@/modules/shared/domain'

/**
 * Auto-opens the venue-onboarding sheet exactly once per (Privy DID, venue id)
 * on the status transition `bootstrapping → incomplete`, provided the seen-store
 * reports `hasSeenOnboarding === false`. On first auto-open the hook calls
 * `markAutoOpened()` so subsequent sessions on this device never re-fire.
 *
 * Guards:
 *  - `previousStatusRef` tracks the prior status so we only act on edges.
 *  - `didTryAutoOpenRef` short-circuits double-firing within a single mount —
 *    e.g. after the user manually closes the sheet, an `incomplete → incomplete`
 *    re-render must NOT trigger a second auto-open.
 *  - When the seen-store provider is not mounted (component tests, surfaces
 *    that haven't been wired yet), `useVenueOnboardingSeenStoreOptional()`
 *    returns `null` and the effect is a no-op.
 *
 * See issue #170 (Slice 10/12) and ADR-0026.
 */
export function useOnboardingAutoOpenEffect(onboarding: VenueOnboarding | null): void {
  const sheet = useVenueOnboardingSheet()
  const seenStore = useVenueOnboardingSeenStoreOptional()

  const previousStatusRef = useRef<VenueOnboardingStatus | null>(null)
  const didTryAutoOpenRef = useRef<boolean>(false)

  const currentStatus: VenueOnboardingStatus | null = onboarding?.status ?? null

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = currentStatus

    if (seenStore === null) return
    if (didTryAutoOpenRef.current) return

    const wasBootstrapping = previousStatus === 'bootstrapping'
    const isNowIncomplete = currentStatus === 'incomplete'
    const isFirstSighting = seenStore.state.hasSeenOnboarding === false

    const shouldAutoOpen = wasBootstrapping && isNowIncomplete && isFirstSighting

    if (!shouldAutoOpen) return

    didTryAutoOpenRef.current = true
    sheet.open()
    seenStore.markAutoOpened()
  }, [currentStatus, seenStore, sheet])
}
