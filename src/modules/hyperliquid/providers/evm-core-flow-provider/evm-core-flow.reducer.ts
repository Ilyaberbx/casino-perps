import { createFlowTransitions } from '../flow-machine/flow-reducer'
import type {
  EvmCoreError,
  EvmCoreFlowAction,
  EvmCoreMachineState,
} from './evm-core-flow-provider.types'

/**
 * The machine starts on the form, Core→EVM, with no token pre-selected (the
 * provider's first token wins via `resolveSelectedToken`) and an empty untouched
 * amount.
 */
export const INITIAL_EVM_CORE_FLOW_STATE: EvmCoreMachineState = {
  phase: 'form',
  direction: 'core-to-evm',
  selectedTokenKey: '',
  amount: '',
  amountTouched: false,
}

/**
 * The single transition point for the EVM⇄Core machine. `errorReason` lives only
 * on `{ phase: 'error' }` (the discriminated `EvmCorePhaseState`), so illegal
 * combinations are unrepresentable. The always-present form fields survive every
 * transition (preserved across errors), so each arm re-threads them via
 * `carried`. Switching the direction or the token resets the amount. `RESET`
 * keeps the active direction so a post-success "Done" returns to the same tab.
 */
export function evmCoreFlowReducer(
  state: EvmCoreMachineState,
  action: EvmCoreFlowAction,
): EvmCoreMachineState {
  const carried = {
    direction: state.direction,
    selectedTokenKey: state.selectedTokenKey,
    amount: state.amount,
    amountTouched: state.amountTouched,
  }
  const shared = createFlowTransitions<
    typeof carried,
    EvmCoreError,
    { readonly transactionHash: `0x${string}` | null }
  >(carried)
  switch (action.type) {
    case 'DIRECTION_CHANGED':
      return { ...state, direction: action.direction, amount: '', amountTouched: false }
    case 'TOKEN_SELECTED':
      return { ...state, selectedTokenKey: action.key, amount: '', amountTouched: false }
    case 'AMOUNT_CHANGED':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'REVIEWED':
      return shared.reviewed()
    case 'BACK':
      return shared.toForm()
    case 'SUBMITTED':
      return shared.signing()
    case 'FAILED':
      return shared.failed(action.reason)
    case 'SENT':
      return shared.sent({ transactionHash: action.transactionHash })
    case 'RETRY':
      return shared.toForm()
    case 'RESET':
      return {
        ...INITIAL_EVM_CORE_FLOW_STATE,
        direction: state.direction,
        selectedTokenKey: action.selectedTokenKey,
      }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
