import type { Market } from '@/modules/shared/domain'
import type {
  EstimateResult,
  RawSuggestion,
  StoredSuggestion,
} from '../../../api/suggestions.types'
import type {
  AgentParamFormViewModel,
  ParamFormValues,
  ParamIssue,
  SuggestStep,
  SuggestionToken,
} from '../perp-suggestion-sheet.types'
import { getMarketCategory } from '../../../trading.utils'
import { ALLOWED_SYMBOLS } from '../ai-agents.constants'
import { SUGGEST_STEPS } from '../perp-suggestion-sheet.constants'

/** A perp `Market` for a base asset — backs token-list icon resolution. Liquid
 *  by default (volume above MIN_MARKET_VOLUME_USD) so the SSoT liquidity gate
 *  (ADR-0064) keeps it; override `volume24h` to exercise the illiquid-drop path. */
export function makeTokenMarket(baseAsset: string): Market {
  return {
    symbol: `${baseAsset}-PERP`,
    baseAsset,
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 1,
    stepSize: 0.001,
    marketType: 'perp',
    hlCoin: baseAsset,
    maxLeverage: 40,
    volume24h: 1_000_000,
  } as Market
}

/** A token entry (display symbol + Market + category) for the token list. */
export function makeSuggestionToken(baseAsset: string): SuggestionToken {
  return {
    symbol: baseAsset,
    market: makeTokenMarket(baseAsset),
    category: getMarketCategory(baseAsset),
  }
}

/** The default offered token list mirroring ALLOWED_SYMBOLS. */
export const DEFAULT_SUGGESTION_TOKENS: readonly SuggestionToken[] = [
  makeSuggestionToken('BTC'),
  makeSuggestionToken('ETH'),
  makeSuggestionToken('SOL'),
]

/** A clean default raw suggestion; override any field per test. */
export function makeRawSuggestion(
  overrides: Partial<RawSuggestion> = {},
): RawSuggestion {
  return {
    side: 'long',
    confidence: 72,
    entryPrice: 60000,
    stopLossPrice: 58000,
    takeProfitPrice: 65000,
    reasons: ['momentum is positive'],
    risks: ['funding flips'],
    ...overrides,
  }
}

/**
 * Build a `StoredSuggestion`. `expiresAt` / `createdAt` default to fixed ISO
 * strings so expiry is deterministic — inject `now` into `isExpired`, never the
 * real clock.
 */
export function makeStoredSuggestion(
  overrides: Partial<StoredSuggestion> = {},
): StoredSuggestion {
  return {
    id: 'sug-1',
    agentId: 'minara',
    requestParams: { symbol: 'BTC', style: 'scalping', marginUsd: 100, leverage: 5 },
    rawSuggestion: makeRawSuggestion(),
    costPaidUsd: '0.50',
    createdAt: '2026-06-14T12:00:00.000Z',
    expiresAt: '2026-06-14T12:05:00.000Z',
    ...overrides,
  }
}

/**
 * The six Suggest steps with a chosen step marked `current` (slice 09): the named
 * step is `current`, every step before it `complete`, every step after `upcoming`.
 * Defaults to the first step (`dex`). Lets dumb-component tests assert the stepper
 * without re-deriving from flow facts.
 */
export function makeSuggestSteps(currentId = 'dex'): readonly SuggestStep[] {
  const currentIndex = SUGGEST_STEPS.findIndex((step) => step.id === currentId)
  return SUGGEST_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
  }))
}

export function makeEstimateResult(
  overrides: Partial<EstimateResult> = {},
): EstimateResult {
  return {
    costUsd: '0.50',
    agentBalanceUsd: '10.00',
    sufficient: true,
    ...overrides,
  }
}

export function makeParamFormValues(
  overrides: Partial<ParamFormValues> = {},
): ParamFormValues {
  return {
    symbol: 'BTC',
    marginUsd: '100',
    leverage: '5',
    style: 'scalping',
    ...overrides,
  }
}

/**
 * A controllable fake of the param-form view-model for dumb-component tests.
 * Setters are no-ops by default; pass spies via `overrides` to assert writes.
 */
export function makeFakeParamForm(
  overrides: Partial<AgentParamFormViewModel> = {},
): AgentParamFormViewModel {
  const issues: readonly ParamIssue[] = overrides.issues ?? []
  return {
    values: makeParamFormValues(),
    issues,
    touched: {},
    allowedSymbols: ALLOWED_SYMBOLS,
    tokens: DEFAULT_SUGGESTION_TOKENS,
    tokensLoading: false,
    marginMax: 1000,
    leverageMax: 40,
    isValid: issues.length === 0,
    setSymbol: () => undefined,
    setMarginUsd: () => undefined,
    setLeverage: () => undefined,
    setStyle: () => undefined,
    toParams: () => ({ symbol: 'BTC', style: 'scalping', marginUsd: 100, leverage: 5 }),
    ...overrides,
  }
}
