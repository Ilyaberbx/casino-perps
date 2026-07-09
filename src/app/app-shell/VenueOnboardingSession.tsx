import type { ReactNode } from 'react'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingProvider } from '@/modules/shared/providers/venue-onboarding-provider'
import type { VenueOnboardingCapability } from '@/modules/shared/domain/venue'
import { useOnboardingCompletionEffect } from './use-onboarding-completion-effect'
import { useOnboardingAutoOpenEffect } from './use-onboarding-auto-open-effect'

/**
 * Mounts the active venue's onboarding capability stack:
 *   <venue.onboarding.provider>
 *     <VenueOnboardingProvider value={venue.onboarding.useVenueOnboarding()}>
 *       {children}
 *     </VenueOnboardingProvider>
 *   </venue.onboarding.provider>
 *
 * When the active venue has no `onboarding` capability (mock-venue, future
 * master-wallet-only venues), the children render with `null` flowing through
 * the generic context — generic gating predicates degrade gracefully (see
 * `useIsVenueOnboardingReady`).
 *
 * Lives under `app/` because it is composition: it bridges a venue's React-
 * bound onboarding capability into the shared context surface. See ADR-0026.
 */
export function VenueOnboardingSession({ children }: { children: ReactNode }) {
  const venue = useVenueOptional()
  const onboarding = venue?.onboarding ?? null

  if (onboarding === null) {
    return <VenueOnboardingProvider value={null}>{children}</VenueOnboardingProvider>
  }

  const Provider = onboarding.provider
  return (
    <Provider>
      <VenueOnboardingBridge onboarding={onboarding}>{children}</VenueOnboardingBridge>
    </Provider>
  )
}

function VenueOnboardingBridge({
  onboarding,
  children,
}: {
  onboarding: VenueOnboardingCapability
  children: ReactNode
}) {
  const value = onboarding.useVenueOnboarding()
  useOnboardingCompletionEffect(value)
  useOnboardingAutoOpenEffect(value)
  return <VenueOnboardingProvider value={value}>{children}</VenueOnboardingProvider>
}
