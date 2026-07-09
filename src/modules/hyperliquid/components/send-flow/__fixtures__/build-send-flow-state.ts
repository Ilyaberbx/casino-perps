import { vi } from 'vitest'
import type {
  SendableToken,
  SendFlowContextValue,
  SendFlowState,
} from '../../../providers/send-flow-provider/send-flow-provider.types'

const USDC: SendableToken = {
  key: 'usd',
  kind: 'usd',
  symbol: 'USDC',
  available: 100,
  decimals: 6,
}

const HYPE: SendableToken = {
  key: 'spot:HYPE',
  kind: 'spot',
  symbol: 'HYPE',
  available: 50,
  decimals: 8,
  tokenId: 'HYPE:0x0d01dc56dcaaca66ad901c959b4011ec',
}

export const FIXTURE_TOKENS: ReadonlyArray<SendableToken> = [USDC, HYPE]

/** A fully-stubbed `SendFlowState` for rendering the body in a given phase. */
export function buildSendFlowState(overrides: Partial<SendFlowState> = {}): SendFlowState {
  return {
    phase: 'form',
    tokens: FIXTURE_TOKENS,
    selectedToken: USDC,
    selectedTokenKey: 'usd',
    amount: '',
    destination: '',
    available: 100,
    symbol: 'USDC',
    isAmountValid: false,
    amountInvalidReason: null,
    isDestinationValid: false,
    destinationInvalidReason: null,
    walletSuggestions: [],
    recentSuggestions: [],
    canReview: false,
    errorReason: null,
    assetsStatus: 'ready',
    retryAssets: vi.fn(),
    selectToken: vi.fn(),
    setAmount: vi.fn(),
    setAmountToMax: vi.fn(),
    setPercent: vi.fn(),
    setDestination: vi.fn(),
    review: vi.fn(),
    back: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

/** The full context value (`{ flow, isApplicable }`) the provider supplies. */
export function buildSendFlowContext(
  overrides: Partial<SendFlowState> = {},
  isApplicable = true,
): SendFlowContextValue {
  return { flow: buildSendFlowState(overrides), isApplicable }
}
