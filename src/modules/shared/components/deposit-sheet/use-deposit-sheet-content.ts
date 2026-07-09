import { useVenueOptional } from '../../providers/venue-provider'
import { useDepositSheet } from '../../providers/deposit-sheet-provider'
import { useIsMobile } from '../../hooks/use-is-mobile'
import type { SheetSide } from '../Sheet'
import type { DepositSheetCapabilityView, DepositSheetContent } from './deposit-sheet.types'

/**
 * Smart hook for the generic deposit-sheet shell. Reads the host open/close
 * controller (`useDepositSheet`) and the active venue (`useVenueOptional`),
 * narrowing on `venue.deposit` to expose the venue's own deposit chrome as an
 * opaque `{ Provider, Body }` view. Knows nothing venue-specific — the body is
 * whatever the venue draws (Option A). Returns `capability: null` when the
 * active venue has no `deposit` slot, so the shell renders nothing.
 */
export function useDepositSheetContent(): DepositSheetContent {
  const { isOpen, close } = useDepositSheet()
  const venue = useVenueOptional()
  const isMobile = useIsMobile()

  const side: SheetSide = isMobile ? 'bottom' : 'right'
  const deposit = venue?.deposit ?? null

  const capability: DepositSheetCapabilityView | null = deposit
    ? { Provider: deposit.provider, Body: deposit.body }
    : null

  return { isOpen, close, side, capability }
}
