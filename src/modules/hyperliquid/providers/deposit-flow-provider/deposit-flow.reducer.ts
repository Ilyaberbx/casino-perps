import type {
  DepositFlowAction,
  DepositFlowMachineState,
} from './deposit-flow-provider.types'

/** The machine starts in `checking` with an empty, untouched amount. */
export const INITIAL_DEPOSIT_FLOW_STATE: DepositFlowMachineState = {
  phase: 'checking',
  walletUsdc: 0,
  amount: '',
  amountTouched: false,
}

/**
 * The single transition point for the deposit machine. `errorReason` /
 * `transactionHash` are carried only by the phases that own them (the
 * discriminated `DepositPhaseState`), so illegal combinations are
 * unrepresentable and no manual reset of a stale reason is possible (WR-DF-01/02).
 *
 * The always-present `amount` / `amountTouched` fields survive every phase
 * transition (preserved across `wallet-rejected` and every error — DepositFlowState
 * contract), so each arm re-threads them; only `AMOUNT_CHANGED` mutates them.
 */
export function depositFlowReducer(
  state: DepositFlowMachineState,
  action: DepositFlowAction,
): DepositFlowMachineState {
  const carried = {
    amount: state.amount,
    amountTouched: state.amountTouched,
    walletUsdc: state.walletUsdc,
  }
  switch (action.type) {
    case 'PREFLIGHT_STARTED':
      return { ...carried, phase: 'checking' }
    case 'BALANCE_TICK':
      return { ...state, walletUsdc: action.walletUsdc }
    case 'PREFLIGHT_RESOLVED':
      return { ...carried, walletUsdc: action.walletUsdc, phase: action.phase }
    case 'FUNDING_ARRIVED':
      return { ...carried, walletUsdc: action.walletUsdc, phase: 'ready' }
    case 'SWITCH_REJECTED':
      return { ...carried, phase: 'wrong-chain' }
    case 'SUBMITTED':
      return { ...carried, phase: 'signing' }
    case 'TRANSFER_REJECTED':
      return { ...carried, phase: 'ready' }
    case 'TRANSFER_SENT':
      return { ...carried, phase: 'sent', transactionHash: action.transactionHash }
    case 'CREDITED':
      return creditFrom(state, carried)
    case 'FAILED':
      return { ...carried, phase: 'error', errorReason: action.reason }
    case 'AMOUNT_CHANGED':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'RETRY':
      return { ...carried, phase: 'checking' }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

/**
 * `credited` keeps the `sent` phase's transaction hash. Credit is only reachable
 * from `sent`; if the machine is anywhere else the action is a no-op (the
 * subscription effect only dispatches while `phase === 'sent'`).
 */
function creditFrom(
  state: DepositFlowMachineState,
  carried: { amount: string; amountTouched: boolean; walletUsdc: number },
): DepositFlowMachineState {
  const isFromSent = state.phase === 'sent'
  if (!isFromSent) return state
  return { ...carried, phase: 'credited', transactionHash: state.transactionHash }
}
