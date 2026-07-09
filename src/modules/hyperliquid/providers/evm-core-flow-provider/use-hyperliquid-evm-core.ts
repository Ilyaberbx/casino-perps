import type { EvmCoreState } from '@/modules/shared/domain'
import { useEvmCoreFlowContext } from './use-evm-core-flow'

/**
 * The port-shaped `useEvmCore()` the HL venue exposes via `VenueEvmCoreCapability`.
 * Projects the rich machine state down to the thin, venue-agnostic
 * `EvmCoreState { isApplicable, isComplete }` the generic host needs to gate the
 * tab and announce completion. The rich state stays internal — the body reads it
 * via `useEvmCoreFlow()`. Must be called inside `EvmCoreFlowProvider` (the shared
 * `useEvmCoreFlowContext` asserts presence).
 */
export function useHyperliquidEvmCore(): EvmCoreState {
  const { flow, isApplicable } = useEvmCoreFlowContext()
  return { isApplicable, isComplete: flow.phase === 'sent' }
}
