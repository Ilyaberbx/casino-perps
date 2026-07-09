import type { TransferState } from '@/modules/shared/domain'
import { useTransferFlowContext } from './use-transfer-flow'

/**
 * The port-shaped `useTransfer()` the HL venue exposes via
 * `VenueTransferCapability`. Projects the rich machine state down to the thin,
 * venue-agnostic `TransferState { isApplicable, isComplete }` the generic host
 * needs to gate the sheet and announce completion. The rich state stays internal
 * — the body reads it via `useTransferFlow()`. Must be called inside
 * `TransferFlowProvider` (the shared `useTransferFlowContext` asserts presence).
 */
export function useHyperliquidTransfer(): TransferState {
  const { flow, isApplicable } = useTransferFlowContext()
  return { isApplicable, isComplete: flow.phase === 'success' }
}
