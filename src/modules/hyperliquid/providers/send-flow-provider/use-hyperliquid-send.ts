import type { SendState } from '@/modules/shared/domain'
import { useSendFlowContext } from './use-send-flow'

/**
 * The port-shaped `useSend()` the HL venue exposes via `VenueSendCapability`.
 * Projects the rich machine state down to the thin, venue-agnostic
 * `SendState { isApplicable, isComplete }` the generic host needs to gate the
 * sheet and announce completion. The rich state stays internal — the body reads
 * it via `useSendFlow()`. Must be called inside `SendFlowProvider` (the shared
 * `useSendFlowContext` asserts presence).
 */
export function useHyperliquidSend(): SendState {
  const { flow, isApplicable } = useSendFlowContext()
  return { isApplicable, isComplete: flow.phase === 'sent' }
}
