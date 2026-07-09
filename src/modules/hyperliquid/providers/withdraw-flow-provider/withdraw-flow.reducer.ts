import { createFlowTransitions } from '../flow-machine/flow-reducer'
import type {
  WithdrawError,
  WithdrawFlowAction,
  WithdrawMachineState,
} from './withdraw-flow-provider.types'

/**
 * The machine starts on the form, with an empty untouched amount and an unedited
 * (prefilled-to-master) destination. The provider seeds `destination` from the
 * resolved master address before mounting; this constant is the no-prefill base.
 */
export const INITIAL_WITHDRAW_FLOW_STATE: WithdrawMachineState = {
  phase: 'form',
  amount: '',
  amountTouched: false,
  destination: '',
  isDestinationEdited: false,
  confirmedIrreversible: false,
}

/**
 * The single transition point for the withdraw machine. `errorReason` lives only
 * on `{ phase: 'error' }` (the discriminated `WithdrawPhaseState`), so illegal
 * combinations are unrepresentable. The always-present form fields survive every
 * transition (preserved across errors — `WithdrawFlowState` contract), so each
 * arm re-threads them via `carried`.
 */
export function withdrawFlowReducer(
  state: WithdrawMachineState,
  action: WithdrawFlowAction,
): WithdrawMachineState {
  const carried = {
    amount: state.amount,
    amountTouched: state.amountTouched,
    destination: state.destination,
    isDestinationEdited: state.isDestinationEdited,
    confirmedIrreversible: state.confirmedIrreversible,
  }
  const shared = createFlowTransitions<typeof carried, WithdrawError>(carried)
  switch (action.type) {
    case 'AMOUNT_CHANGED':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'DESTINATION_CHANGED':
      return { ...state, destination: action.destination, isDestinationEdited: true }
    case 'CONFIRM_TOGGLED':
      return { ...state, confirmedIrreversible: !state.confirmedIrreversible }
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
      return { ...INITIAL_WITHDRAW_FLOW_STATE, destination: action.destination }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
