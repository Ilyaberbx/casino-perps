import { vi } from 'vitest'
import type { DepositFlowState } from '../../../providers/deposit-flow-provider'

/** A fully-stubbed `DepositFlowState` for rendering the body in a given phase. */
export function buildDepositFlowState(
  overrides: Partial<DepositFlowState> = {},
): DepositFlowState {
  return {
    phase: 'ready',
    walletUsdc: 100,
    amount: '',
    isAmountValid: false,
    amountInvalidReason: null,
    errorReason: null,
    transactionHash: null,
    setAmount: vi.fn(),
    setAmountToMax: vi.fn(),
    switchChain: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  }
}
