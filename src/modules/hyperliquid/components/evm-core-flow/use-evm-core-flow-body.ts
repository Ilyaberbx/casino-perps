import { useEvmCoreFlow } from '../../providers/evm-core-flow-provider'
import type { EvmCoreFlowState } from '../../providers/evm-core-flow-provider'

export interface EvmCoreFlowBodyView {
  readonly flow: EvmCoreFlowState
}

/**
 * Smart hook for the EVM⇄Core body. Thin pass-through over the rich machine state
 * (`useEvmCoreFlow`) — the body needs nothing else; every action lives on the
 * flow. Kept as a hook so the body component stays dumb and the seam is testable.
 */
export function useEvmCoreFlowBody(): EvmCoreFlowBodyView {
  const flow = useEvmCoreFlow()
  return { flow }
}
