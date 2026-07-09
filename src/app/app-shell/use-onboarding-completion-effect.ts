import { useEffect, useRef } from 'react'
import { toast } from '@/modules/shared/services/toast'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import type { VenueOnboarding, VenueOnboardingStatus } from '@/modules/shared/domain'

/**
 * Fires a success toast and closes the venue-onboarding sheet on the transition
 * `incomplete` → `ready`. Subsequent `ready → ready` re-renders do NOT re-fire.
 *
 * The edge is deliberately `incomplete → ready`, NOT any non-`ready` → `ready`:
 * the only way to reach `ready` from `incomplete` is the user completing the
 * remaining steps in-session — a genuine first-time onboarding. An already-
 * onboarded reload rehydrates `bootstrapping → ready` (the venue stays
 * `bootstrapping` until every step's initial check settles — see
 * `use-own-hyperliquid-venue-onboarding`), which this guard excludes, so no
 * spurious "setup complete" toast fires on reload.
 *
 * Implemented as a transition guard via `useRef`: the previous status is kept
 * across renders and compared with the current status; the side effect runs
 * exactly once per `incomplete` → `ready` edge.
 *
 * The toast fires regardless of whether the sheet is open — if the user closed
 * the sheet mid-signing (the orchestrator preserves state across open/close per
 * #165), the eventual `ready` still produces the toast.
 *
 * See issue #171 (Slice 11/12) and ADR-0026.
 */
export function useOnboardingCompletionEffect(onboarding: VenueOnboarding | null): void {
  const sheet = useVenueOnboardingSheet()
  const previousStatusRef = useRef<VenueOnboardingStatus | null>(null)

  const currentStatus: VenueOnboardingStatus | null = onboarding?.status ?? null
  const venueLabel: string | null = onboarding?.venueLabel ?? null

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = currentStatus

    const wasIncomplete = previousStatus === 'incomplete'
    const isNowReady = currentStatus === 'ready'
    const hasJustCompleted = wasIncomplete && isNowReady

    if (!hasJustCompleted) return
    if (venueLabel === null) return

    toast.show({
      variant: 'success',
      title: `${venueLabel} setup complete`,
      description: 'You can now trade.',
    })
    sheet.close()
  }, [currentStatus, venueLabel, sheet])
}
