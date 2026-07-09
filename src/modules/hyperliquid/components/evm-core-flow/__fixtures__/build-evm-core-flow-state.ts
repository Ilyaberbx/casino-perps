import { vi } from 'vitest'
import type {
  EvmCoreFlowContextValue,
  EvmCoreFlowState,
  EvmCoreToken,
} from '../../../providers/evm-core-flow-provider/evm-core-flow-provider.types'

const UBTC: EvmCoreToken = {
  key: 'evm-core:BTC',
  symbol: 'BTC',
  name: 'UBTC',
  index: 197,
  tokenId: 'UBTC:0x8f254b963e8468305d409b33aa137c67',
  available: 2,
  decimals: 8,
  isHype: false,
  evmExtraWeiDecimals: 0,
  evmAddress: '0x8f254b963e8468305d409b33aa137c67aabbccdd',
}

const HYPE: EvmCoreToken = {
  key: 'evm-core:HYPE',
  symbol: 'HYPE',
  name: 'HYPE',
  index: 150,
  tokenId: 'HYPE:0x0d01dc56dcaaca66ad901c959b4011ec',
  available: 50,
  decimals: 8,
  isHype: true,
  evmExtraWeiDecimals: 10,
  evmAddress: null,
}

export const FIXTURE_TOKENS: ReadonlyArray<EvmCoreToken> = [UBTC, HYPE]

/** A fully-stubbed `EvmCoreFlowState` for rendering the body in a given phase. */
export function buildEvmCoreFlowState(
  overrides: Partial<EvmCoreFlowState> = {},
): EvmCoreFlowState {
  return {
    phase: 'form',
    direction: 'core-to-evm',
    tokens: FIXTURE_TOKENS,
    selectedToken: UBTC,
    selectedTokenKey: 'evm-core:BTC',
    amount: '',
    available: 2,
    symbol: 'BTC',
    isAmountValid: false,
    amountInvalidReason: null,
    canReview: false,
    errorReason: null,
    evmPreflight: 'ready',
    assetsStatus: 'ready',
    transactionHash: null,
    explorerTxUrl: null,
    setDirection: vi.fn(),
    retryAssets: vi.fn(),
    switchChain: vi.fn(),
    selectToken: vi.fn(),
    setAmount: vi.fn(),
    setAmountToMax: vi.fn(),
    setPercent: vi.fn(),
    review: vi.fn(),
    back: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

/** The full context value (`{ flow, isApplicable }`) the provider supplies. */
export function buildEvmCoreFlowContext(
  overrides: Partial<EvmCoreFlowState> = {},
  isApplicable = true,
): EvmCoreFlowContextValue {
  return { flow: buildEvmCoreFlowState(overrides), isApplicable }
}
