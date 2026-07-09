import type { DepositState } from '@/modules/shared/domain'
import { useDepositFlowContext } from './use-deposit-flow'

/**
 * The port-shaped `useDeposit()` the HL venue exposes via
 * `VenueDepositCapability`. Projects the rich machine phase down to the thin,
 * venue-agnostic `DepositState { isComplete }` the generic host needs to offer
 * a close / "Start trading" affordance. The rich state stays internal — the
 * body reads it via `useDepositFlow()`. Must be called inside
 * `DepositFlowProvider` (the shared `useDepositFlowContext` asserts presence).
 */
export function useHyperliquidDeposit(): DepositState {
  const ctx = useDepositFlowContext()
  return { isComplete: ctx.phase === 'credited' }
}
