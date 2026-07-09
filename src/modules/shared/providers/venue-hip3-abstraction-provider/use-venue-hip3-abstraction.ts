import { useContext } from 'react'
import {
  HIP3_ABSTRACTION_UNSET,
  VenueHip3AbstractionContext,
} from './venue-hip3-abstraction-provider.context'
import type { Hip3AbstractionContextValue } from './venue-hip3-abstraction-provider.types'

/**
 * Returns the active venue's HIP-3 abstraction state, or `null` when the active
 * venue exposes no HIP-3 abstraction capability **or** the provider was never
 * mounted. Non-throwing (mirrors `useCapabilityOptional`): the sole consumer is
 * a pass-through submit gate (`<Hip3AbstractionGateButton>`), which degrades to
 * rendering its children when this is `null` — so a missing provider is a safe
 * no-op, not a crash. This lets any surface that renders the order ticket omit
 * the provider without breaking.
 */
export function useVenueHip3Abstraction(): Hip3AbstractionContextValue {
  const slot = useContext(VenueHip3AbstractionContext)
  if (slot === HIP3_ABSTRACTION_UNSET) return null
  // Narrowing past the unique-symbol sentinel: TS can't drop the symbol from the
  // union, so we cast — the guard above guarantees the variant.
  return slot as Hip3AbstractionContextValue
}
