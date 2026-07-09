import type { ReactNode } from 'react'
import type { Hip3AbstractionState } from '../../domain/venue-hip3-abstraction'

/**
 * `null` when the active venue exposes no HIP-3 abstraction capability
 * (mock-venue, or any venue without HIP-3 markets). The shared gate degrades to
 * pass-through in that case.
 */
export type Hip3AbstractionContextValue = Hip3AbstractionState | null

export interface VenueHip3AbstractionProviderProps {
  readonly value: Hip3AbstractionContextValue
  readonly children: ReactNode
}
