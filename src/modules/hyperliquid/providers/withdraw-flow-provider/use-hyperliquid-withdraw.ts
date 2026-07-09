import type { WithdrawState } from '@/modules/shared/domain'
import { useWithdrawFlowContext } from './use-withdraw-flow'

/**
 * The port-shaped `useWithdraw()` the HL venue exposes via
 * `VenueWithdrawCapability`. Projects the rich machine state down to the thin,
 * venue-agnostic `WithdrawState { isApplicable, isComplete }` the generic host
 * needs to gate the sheet and announce completion. The rich state stays internal
 * — the body reads it via `useWithdrawFlow()`. Must be called inside
 * `WithdrawFlowProvider` (the shared `useWithdrawFlowContext` asserts presence).
 */
export function useHyperliquidWithdraw(): WithdrawState {
  const { flow, isApplicable } = useWithdrawFlowContext()
  return { isApplicable, isComplete: flow.phase === 'sent' }
}
