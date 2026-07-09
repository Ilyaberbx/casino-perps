import { useVenueOptional } from '../../providers/venue-provider'
import { useTransferSheet } from '../../providers/transfer-sheet-provider'
import { useIsMobile } from '../../hooks/use-is-mobile'
import type { SheetSide } from '../Sheet'
import type {
  TransferSheetCapabilityView,
  TransferSheetContent,
} from './transfer-sheet.types'

/**
 * Smart hook for the generic transfer-sheet shell. Reads the host open/close
 * controller (`useTransferSheet`) and the active venue (`useVenueOptional`),
 * narrowing on `venue.transfer` to expose the venue's own transfer chrome as an
 * opaque `{ Provider, Body, useTransfer }` view. Knows nothing venue-specific —
 * the body is whatever the venue draws (Option A). Returns `capability: null`
 * when the active venue has no `transfer` slot, so the shell renders nothing.
 * The `isApplicable` gate runs one level deeper (inside the mounted provider),
 * via the inner gate that reads `useTransfer()`.
 */
export function useTransferSheetContent(): TransferSheetContent {
  const { isOpen, close } = useTransferSheet()
  const venue = useVenueOptional()
  const isMobile = useIsMobile()

  const side: SheetSide = isMobile ? 'bottom' : 'right'
  const transfer = venue?.transfer ?? null

  const capability: TransferSheetCapabilityView | null = transfer
    ? { Provider: transfer.provider, Body: transfer.body, useTransfer: transfer.useTransfer }
    : null

  return { isOpen, close, side, capability }
}
