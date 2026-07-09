import type { ReactNode } from 'react'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import { VenueHip3AbstractionProvider } from '@/modules/shared/providers/venue-hip3-abstraction-provider'
import type { VenueHip3AbstractionCapability } from '@/modules/shared/domain'

/**
 * Mounts the active venue's HIP-3 abstraction capability stack:
 *   <venue.hip3Abstraction.provider>
 *     <VenueHip3AbstractionProvider value={venue.hip3Abstraction.useHip3Abstraction()}>
 *       {children}
 *     </VenueHip3AbstractionProvider>
 *   </venue.hip3Abstraction.provider>
 *
 * When the active venue has no `hip3Abstraction` capability (mock-venue, any
 * venue without HIP-3 markets), children render with `null` flowing through the
 * generic context — the shared `<Hip3AbstractionGateButton>` then always passes
 * through.
 *
 * Lives under `app/` because it is composition: it bridges a venue's React-bound
 * capability into the shared context surface. Mirrors `VenueOnboardingSession`
 * (ADR-0081).
 */
export function VenueHip3AbstractionSession({ children }: { children: ReactNode }) {
  const venue = useVenueOptional()
  const hip3Abstraction = venue?.hip3Abstraction ?? null

  if (hip3Abstraction === null) {
    return <VenueHip3AbstractionProvider value={null}>{children}</VenueHip3AbstractionProvider>
  }

  const Provider = hip3Abstraction.provider
  return (
    <Provider>
      <VenueHip3AbstractionBridge hip3Abstraction={hip3Abstraction}>
        {children}
      </VenueHip3AbstractionBridge>
    </Provider>
  )
}

function VenueHip3AbstractionBridge({
  hip3Abstraction,
  children,
}: {
  hip3Abstraction: VenueHip3AbstractionCapability
  children: ReactNode
}) {
  const value = hip3Abstraction.useHip3Abstraction()
  return <VenueHip3AbstractionProvider value={value}>{children}</VenueHip3AbstractionProvider>
}
