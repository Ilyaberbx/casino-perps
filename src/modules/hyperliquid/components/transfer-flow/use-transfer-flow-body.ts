import { useTransferFlow } from '../../providers/transfer-flow-provider'
import type { TransferFlowState } from '../../providers/transfer-flow-provider'

export interface TransferFlowBodyView {
  readonly flow: TransferFlowState
}

/**
 * Smart hook for the transfer body. Thin pass-through over the rich machine
 * state (`useTransferFlow`) — the body needs nothing else (success closes the
 * sheet from the provider, so there is no terminal "Done" affordance here). Kept
 * as a hook so the body component stays dumb and the seam is testable.
 */
export function useTransferFlowBody(): TransferFlowBodyView {
  const flow = useTransferFlow()
  return { flow }
}
