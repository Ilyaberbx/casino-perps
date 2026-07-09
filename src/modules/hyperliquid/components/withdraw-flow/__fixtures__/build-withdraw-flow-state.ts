import { vi } from 'vitest'
import type {
  WithdrawFlowContextValue,
  WithdrawFlowState,
} from '../../../providers/withdraw-flow-provider/withdraw-flow-provider.types'

/** A fully-stubbed `WithdrawFlowState` for rendering the body in a given phase. */
export function buildWithdrawFlowState(
  overrides: Partial<WithdrawFlowState> = {},
): WithdrawFlowState {
  return {
    phase: 'form',
    amount: '',
    destination: '0x1111111111111111111111111111111111111111',
    isDestinationEdited: false,
    confirmedIrreversible: false,
    withdrawable: 100,
    fee: 1,
    minWithdraw: 2,
    netReceived: 0,
    isAmountValid: false,
    amountInvalidReason: null,
    isDestinationValid: true,
    walletSuggestions: [],
    recentSuggestions: [],
    canReview: false,
    errorReason: null,
    setAmount: vi.fn(),
    setAmountToMax: vi.fn(),
    setPercent: vi.fn(),
    setDestination: vi.fn(),
    toggleConfirmIrreversible: vi.fn(),
    review: vi.fn(),
    back: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

/** The full context value (`{ flow, isApplicable }`) the provider supplies. */
export function buildWithdrawFlowContext(
  overrides: Partial<WithdrawFlowState> = {},
  isApplicable = true,
): WithdrawFlowContextValue {
  return { flow: buildWithdrawFlowState(overrides), isApplicable }
}
