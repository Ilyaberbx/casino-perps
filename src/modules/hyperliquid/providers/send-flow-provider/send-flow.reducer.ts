import { createFlowTransitions } from '../flow-machine/flow-reducer'
import { USD_TOKEN_KEY } from './send-flow.constants'
import type { SendError, SendFlowAction, SendMachineState } from './send-flow-provider.types'

/**
 * The machine starts on the form, with USDC selected, an empty untouched amount,
 * and an empty untouched destination (no prefill — a send goes to an external
 * address). The provider may re-seed `selectedTokenKey` if USDC is not present;
 * this constant is the no-token base.
 */
export const INITIAL_SEND_FLOW_STATE: SendMachineState = {
  phase: 'form',
  selectedTokenKey: USD_TOKEN_KEY,
  amount: '',
  amountTouched: false,
  destination: '',
  destinationTouched: false,
}

/**
 * The single transition point for the send machine. `errorReason` lives only on
 * `{ phase: 'error' }` (the discriminated `SendPhaseState`), so illegal
 * combinations are unrepresentable. The always-present form fields survive every
 * transition (preserved across errors — `SendFlowState` contract), so each arm
 * re-threads them via `carried`. Switching the selected token resets the amount
 * (a 5-USDC amount is meaningless once you switch to a BTC balance).
 */
export function sendFlowReducer(
  state: SendMachineState,
  action: SendFlowAction,
): SendMachineState {
  const carried = {
    selectedTokenKey: state.selectedTokenKey,
    amount: state.amount,
    amountTouched: state.amountTouched,
    destination: state.destination,
    destinationTouched: state.destinationTouched,
  }
  const shared = createFlowTransitions<typeof carried, SendError>(carried)
  switch (action.type) {
    case 'TOKEN_SELECTED':
      return { ...state, selectedTokenKey: action.key, amount: '', amountTouched: false }
    case 'AMOUNT_CHANGED':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'DESTINATION_CHANGED':
      return { ...state, destination: action.destination, destinationTouched: true }
    case 'REVIEWED':
      return shared.reviewed()
    case 'BACK':
      return shared.toForm()
    case 'SUBMITTED':
      return shared.signing()
    case 'FAILED':
      return shared.failed(action.reason)
    case 'SENT':
      return shared.sent({})
    case 'RETRY':
      return shared.toForm()
    case 'RESET':
      return { ...INITIAL_SEND_FLOW_STATE, selectedTokenKey: action.selectedTokenKey }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
