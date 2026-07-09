import { oppositeAccount } from './transfer-flow.utils'
import type {
  TransferFlowAction,
  TransferMachineState,
} from './transfer-flow-provider.types'

/** The machine starts idle, Spot→Perp, with an empty untouched amount. */
export const INITIAL_TRANSFER_FLOW_STATE: TransferMachineState = {
  phase: 'idle',
  from: 'spot',
  amount: '',
  amountTouched: false,
}

/**
 * The single transition point for the transfer machine. `errorReason` lives only
 * on `{ phase: 'error' }` (the discriminated `TransferPhaseState`), so illegal
 * combinations are unrepresentable. The always-present `from` / `amount` /
 * `amountTouched` fields survive every transition (preserved across errors —
 * `TransferFlowState` contract), so each arm re-threads them.
 */
export function transferFlowReducer(
  state: TransferMachineState,
  action: TransferFlowAction,
): TransferMachineState {
  const carried = {
    from: state.from,
    amount: state.amount,
    amountTouched: state.amountTouched,
  }
  switch (action.type) {
    case 'AMOUNT_CHANGED':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'DIRECTION_SET':
      return { ...carried, from: action.from, phase: 'idle' }
    case 'SWAPPED':
      return { ...carried, from: oppositeAccount(state.from), phase: 'idle' }
    case 'SUBMITTED':
      return { ...carried, phase: 'signing' }
    case 'FAILED':
      return { ...carried, phase: 'error', errorReason: action.reason }
    case 'SUCCEEDED':
      return { ...carried, phase: 'success' }
    case 'RETRY':
      return { ...carried, phase: 'idle' }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
