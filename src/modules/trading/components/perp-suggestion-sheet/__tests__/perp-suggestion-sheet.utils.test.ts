import { describe, it, expect } from 'vitest'
import {
  ApiError,
  NetworkError,
  ParseError,
  SessionExpiredError,
} from '@/modules/shared/http'
import type { Market } from '@/modules/shared/domain'
import {
  deriveSuggestSteps,
  filterTokensBySearch,
  filterTokensByVenueLiquidity,
  formatUpdatedAgo,
  isEstimateStale,
  isExpired,
  mapExecuteError,
  paramIssueFor,
  resolveAgentIconKind,
  toSuggestionParams,
  validateParams,
} from '../perp-suggestion-sheet.utils'
import type { SuggestFlowState } from '../perp-suggestion-sheet.utils'
import { ESTIMATE_GRACE_PERIOD_MS } from '../perp-suggestion-sheet.constants'
import { MIN_MARKET_VOLUME_USD } from '../../../trading.constants'
import {
  makeParamFormValues,
  makeSuggestionToken,
  makeTokenMarket,
} from '../__fixtures__/suggestions'

function venueMarket(baseAsset: string, volume24h: number): Market {
  return { ...makeTokenMarket(baseAsset), volume24h }
}

describe('resolveAgentIconKind', () => {
  it('maps a known agent id to its declared icon kind', () => {
    expect(resolveAgentIconKind('minara')).toBe('minara')
    expect(resolveAgentIconKind('native')).toBe('three-eye')
  })

  it('falls back to the three-eye motif for an unknown provider', () => {
    expect(resolveAgentIconKind('mystery-agent')).toBe('three-eye')
  })
})

describe('filterTokensBySearch', () => {
  const tokens = [
    makeSuggestionToken('BTC'),
    makeSuggestionToken('ETH'),
    makeSuggestionToken('SOL'),
  ]

  it('returns all tokens for an empty query', () => {
    expect(filterTokensBySearch(tokens, '')).toHaveLength(3)
  })

  it('filters by symbol case-insensitively', () => {
    expect(filterTokensBySearch(tokens, 'eth').map((t) => t.symbol)).toEqual(['ETH'])
  })

  it('filters by base asset', () => {
    expect(filterTokensBySearch(tokens, 'SOL').map((t) => t.symbol)).toEqual(['SOL'])
  })
})

describe('filterTokensByVenueLiquidity', () => {
  const tokens = [
    makeSuggestionToken('BTC'),
    makeSuggestionToken('ETH'),
    makeSuggestionToken('AAPL'),
  ]
  const ABOVE = MIN_MARKET_VOLUME_USD
  const BELOW = MIN_MARKET_VOLUME_USD - 1

  it('returns the full catalog unchanged when the venue list is empty (stability fallback)', () => {
    expect(filterTokensByVenueLiquidity(tokens, [], MIN_MARKET_VOLUME_USD)).toHaveLength(3)
  })

  it('drops a venue-listed token below the volume floor', () => {
    const venueMarkets = [venueMarket('BTC', BELOW), venueMarket('ETH', ABOVE)]
    expect(
      filterTokensByVenueLiquidity(tokens, venueMarkets, MIN_MARKET_VOLUME_USD).map(
        (t) => t.symbol,
      ),
    ).not.toContain('BTC')
  })

  it('keeps a venue-listed token at or above the floor', () => {
    const venueMarkets = [venueMarket('ETH', ABOVE)]
    expect(
      filterTokensByVenueLiquidity(tokens, venueMarkets, MIN_MARKET_VOLUME_USD).map(
        (t) => t.symbol,
      ),
    ).toContain('ETH')
  })

  it('keeps a token the venue does not list at all (AI-only superset)', () => {
    // AAPL is not in the venue list, yet the list is non-empty — it must survive.
    const venueMarkets = [venueMarket('BTC', ABOVE), venueMarket('ETH', ABOVE)]
    expect(
      filterTokensByVenueLiquidity(tokens, venueMarkets, MIN_MARKET_VOLUME_USD).map(
        (t) => t.symbol,
      ),
    ).toContain('AAPL')
  })

  it('ignores spot markets when deciding venue listing/liquidity', () => {
    const spotBtc: Market = { ...makeTokenMarket('BTC'), marketType: 'spot', volume24h: BELOW }
    // BTC only appears as an illiquid SPOT market → treated as not-a-perp →
    // unlisted → kept as a superset entry (not dropped on the spot volume).
    expect(
      filterTokensByVenueLiquidity(tokens, [spotBtc], MIN_MARKET_VOLUME_USD).map((t) => t.symbol),
    ).toContain('BTC')
  })
})

describe('paramIssueFor', () => {
  it('returns the message for the matching field', () => {
    const issues = [
      { field: 'marginUsd' as const, message: 'too big' },
      { field: 'leverage' as const, message: 'too high' },
    ]
    expect(paramIssueFor(issues, 'leverage')).toBe('too high')
  })

  it('returns null when no issue tags that field', () => {
    const issues = [{ field: 'marginUsd' as const, message: 'too big' }]
    expect(paramIssueFor(issues, 'symbol')).toBeNull()
  })

  it('returns null for an empty issue list', () => {
    expect(paramIssueFor([], 'marginUsd')).toBeNull()
  })
})

describe('validateParams', () => {
  const marginMax = 1000
  const leverageMax = 20

  it('returns no issues for a clean, in-bounds request', () => {
    const values = makeParamFormValues({ marginUsd: '500', leverage: '10' })
    expect(validateParams(values, marginMax, leverageMax)).toEqual([])
  })

  it('tags symbol when blank', () => {
    const values = makeParamFormValues({ symbol: '   ' })
    const issues = validateParams(values, marginMax, leverageMax)
    expect(issues).toContainEqual({ field: 'symbol', message: 'Select a market' })
  })

  it('tags margin when non-positive / blank', () => {
    const values = makeParamFormValues({ marginUsd: '' })
    const issues = validateParams(values, marginMax, leverageMax)
    expect(issues).toContainEqual({
      field: 'marginUsd',
      message: 'Enter a margin amount',
    })
  })

  it('tags margin when it exceeds the live collateral cap', () => {
    const values = makeParamFormValues({ marginUsd: '1500' })
    const issues = validateParams(values, marginMax, leverageMax)
    expect(issues).toContainEqual({
      field: 'marginUsd',
      message: 'Margin exceeds available collateral ($1,000.00)',
    })
  })

  it('accepts margin exactly equal to the cap (margin <= collateral)', () => {
    const values = makeParamFormValues({ marginUsd: String(marginMax) })
    const marginIssues = validateParams(values, marginMax, leverageMax).filter(
      (i) => i.field === 'marginUsd',
    )
    expect(marginIssues).toEqual([])
  })

  it('tags leverage below 1x', () => {
    const values = makeParamFormValues({ leverage: '0' })
    const issues = validateParams(values, marginMax, leverageMax)
    expect(issues).toContainEqual({
      field: 'leverage',
      message: 'Enter leverage of at least 1x',
    })
  })

  it('tags leverage above the cap', () => {
    const values = makeParamFormValues({ leverage: '50' })
    const issues = validateParams(values, marginMax, leverageMax)
    expect(issues).toContainEqual({
      field: 'leverage',
      message: `Leverage exceeds the cap (${leverageMax}x)`,
    })
  })

  it('accepts leverage exactly equal to the cap (leverage <= cap)', () => {
    const values = makeParamFormValues({ leverage: String(leverageMax) })
    const leverageIssues = validateParams(values, marginMax, leverageMax).filter(
      (i) => i.field === 'leverage',
    )
    expect(leverageIssues).toEqual([])
  })
})

describe('toSuggestionParams', () => {
  it('projects raw form strings into typed params', () => {
    const values = makeParamFormValues({
      symbol: 'ETH',
      marginUsd: '250',
      leverage: '8',
      style: 'swing-trading',
    })
    expect(toSuggestionParams(values)).toEqual({
      symbol: 'ETH',
      style: 'swing-trading',
      marginUsd: 250,
      leverage: 8,
    })
  })

  it('passes undefined for blank / unparseable numbers', () => {
    const values = makeParamFormValues({ marginUsd: '', leverage: 'abc' })
    const params = toSuggestionParams(values)
    expect(params.marginUsd).toBeUndefined()
    expect(params.leverage).toBeUndefined()
  })
})

describe('isExpired', () => {
  const expiresAt = '2026-06-14T12:05:00.000Z'
  const expiresAtMs = new Date(expiresAt).getTime()

  it('is false strictly before expiresAt', () => {
    expect(isExpired(expiresAt, expiresAtMs - 1)).toBe(false)
  })

  it('is true exactly at expiresAt (expiresAt <= now)', () => {
    expect(isExpired(expiresAt, expiresAtMs)).toBe(true)
  })

  it('is true strictly after expiresAt', () => {
    expect(isExpired(expiresAt, expiresAtMs + 1)).toBe(true)
  })

  it('treats an unparseable date as expired', () => {
    expect(isExpired('not-a-date', expiresAtMs - 100000)).toBe(true)
  })
})

describe('mapExecuteError', () => {
  it('maps session-expired to a non-retryable reconnect message', () => {
    const mapped = mapExecuteError(new SessionExpiredError('/api/suggestions'))
    expect(mapped.title).toBe('Session expired')
    expect(mapped.retryable).toBe(false)
  })

  it('maps network errors to a retryable message', () => {
    const mapped = mapExecuteError(new NetworkError('offline', new Error('x')))
    expect(mapped.title).toBe('Network error')
    expect(mapped.retryable).toBe(true)
  })

  it('maps parse errors to a retryable unexpected-response message', () => {
    const mapped = mapExecuteError(new ParseError('bad json', new Error('x')))
    expect(mapped.title).toBe('Unexpected response')
    expect(mapped.retryable).toBe(true)
  })

  it('maps a 402 status to insufficient agent balance', () => {
    const mapped = mapExecuteError(new ApiError(402, '/api/suggestions', null))
    expect(mapped.title).toBe('Insufficient Agent Balance')
    expect(mapped.retryable).toBe(false)
  })

  it('maps the INSUFFICIENT_AGENT_BALANCE code to insufficient balance', () => {
    const body = { error: { code: 'INSUFFICIENT_AGENT_BALANCE' } }
    const mapped = mapExecuteError(new ApiError(400, '/api/suggestions', body))
    expect(mapped.title).toBe('Insufficient Agent Balance')
  })

  it('maps the UNKNOWN_AGENT code to agent unavailable', () => {
    const body = { error: { code: 'UNKNOWN_AGENT' } }
    const mapped = mapExecuteError(new ApiError(404, '/api/suggestions', body))
    expect(mapped.title).toBe('Agent unavailable')
    expect(mapped.retryable).toBe(false)
  })

  it('maps the DELEGATION_NOT_ACTIVE code to signingless-access-expired', () => {
    const body = { error: { code: 'DELEGATION_NOT_ACTIVE' } }
    const mapped = mapExecuteError(new ApiError(403, '/api/suggestions', body))
    expect(mapped.title).toBe('Signingless access expired')
    expect(mapped.retryable).toBe(false)
  })

  it('maps a 422 status to a non-retryable invalid request (fix, not retry)', () => {
    const mapped = mapExecuteError(new ApiError(422, '/api/suggestions', null))
    expect(mapped.title).toBe('Invalid request')
    expect(mapped.retryable).toBe(false)
  })

  it('maps the SUGGESTION_INPUT_INVALID code to invalid request', () => {
    const body = { error: { code: 'SUGGESTION_INPUT_INVALID' } }
    const mapped = mapExecuteError(new ApiError(400, '/api/suggestions', body))
    expect(mapped.title).toBe('Invalid request')
  })

  it('falls back to a retryable agent-unavailable message for unknown api errors', () => {
    const mapped = mapExecuteError(new ApiError(500, '/api/suggestions', null))
    expect(mapped.title).toBe('Agent unavailable')
    expect(mapped.retryable).toBe(true)
  })

  it('carries no detail lines for a transport / non-422 failure', () => {
    expect(mapExecuteError(new NetworkError('offline', new Error('x'))).details).toEqual([])
    expect(
      mapExecuteError(new ApiError(402, '/api/suggestions', null)).details,
    ).toEqual([])
  })
})

describe('mapExecuteError — 422 issue surfacing', () => {
  function inputInvalid(issues: Record<string, string>, message?: string) {
    const error = { code: 'SUGGESTION_INPUT_INVALID', message, issues }
    return new ApiError(422, '/api/suggestions', { error })
  }

  it('surfaces the symbol-not-listed issue line including the offending symbol', () => {
    const mapped = mapExecuteError(
      inputInvalid({ symbol: '"PEPE" is not a listed market' }),
    )
    expect(mapped.details).toContain('"PEPE" is not a listed market')
  })

  it('surfaces the leverage-over-cap issue line including the value and cap', () => {
    const mapped = mapExecuteError(
      inputInvalid({ leverage: 'Leverage 50x exceeds the 40x venue cap' }),
    )
    expect(mapped.details).toContain('Leverage 50x exceeds the 40x venue cap')
  })

  it('surfaces the insufficient-agent-balance issue line including the shortfall', () => {
    const line =
      'Agent Balance $1.00 is below the $5.00 call price — deposit USDC to continue'
    const mapped = mapExecuteError(inputInvalid({ agentBalance: line }))
    expect(mapped.details).toContain(line)
  })

  it('surfaces every issue together when multiple are present', () => {
    const mapped = mapExecuteError(
      inputInvalid({
        symbol: '"PEPE" is not a listed market',
        leverage: 'Leverage 50x exceeds the 40x venue cap',
      }),
    )
    expect(mapped.details).toEqual([
      '"PEPE" is not a listed market',
      'Leverage 50x exceeds the 40x venue cap',
    ])
  })

  it('leads with the server summary message and stays non-retryable', () => {
    const mapped = mapExecuteError(
      inputInvalid(
        { leverage: 'Leverage 50x exceeds the 40x venue cap' },
        'Leverage 50x exceeds the 40x venue cap',
      ),
    )
    expect(mapped.detail).toBe('Leverage 50x exceeds the 40x venue cap')
    expect(mapped.retryable).toBe(false)
  })

  it('falls back to a generic detail when a 422 carries no issue map', () => {
    const mapped = mapExecuteError(
      new ApiError(422, '/api/suggestions', { error: { code: 'SUGGESTION_INPUT_INVALID' } }),
    )
    expect(mapped.detail).toBe('Adjust your inputs and try again.')
    expect(mapped.details).toEqual([])
  })

  it('falls back safely on a malformed 422 body (no any cast, no throw)', () => {
    const mapped = mapExecuteError(new ApiError(422, '/api/suggestions', 'oops'))
    expect(mapped.title).toBe('Invalid request')
    expect(mapped.details).toEqual([])
  })
})

describe('formatUpdatedAgo (slice 07)', () => {
  const PRODUCED_AT = 1_000_000

  it('reads "updated just now" under one second', () => {
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT)).toBe('updated just now')
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 999)).toBe('updated just now')
  })

  it('counts whole seconds under a minute', () => {
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 1_000)).toBe('updated 1s ago')
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 12_500)).toBe('updated 12s ago')
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 59_000)).toBe('updated 59s ago')
  })

  it('counts whole minutes at a minute or more', () => {
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 60_000)).toBe('updated 1m ago')
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT + 150_000)).toBe('updated 2m ago')
  })

  it('clamps a future producedAt (clock skew) to "just now"', () => {
    expect(formatUpdatedAgo(PRODUCED_AT, PRODUCED_AT - 5_000)).toBe('updated just now')
  })
})

describe('isEstimateStale (slice 07)', () => {
  const PRODUCED_AT = 1_000_000

  it('is fresh before the grace period elapses', () => {
    expect(
      isEstimateStale(PRODUCED_AT, PRODUCED_AT + 9_999, ESTIMATE_GRACE_PERIOD_MS),
    ).toBe(false)
  })

  it('is still fresh exactly at the grace boundary', () => {
    expect(
      isEstimateStale(
        PRODUCED_AT,
        PRODUCED_AT + ESTIMATE_GRACE_PERIOD_MS,
        ESTIMATE_GRACE_PERIOD_MS,
      ),
    ).toBe(false)
  })

  it('is stale once strictly past the grace period', () => {
    expect(
      isEstimateStale(
        PRODUCED_AT,
        PRODUCED_AT + ESTIMATE_GRACE_PERIOD_MS + 1,
        ESTIMATE_GRACE_PERIOD_MS,
      ),
    ).toBe(true)
  })
})

describe('deriveSuggestSteps', () => {
  const baseFlow: SuggestFlowState = {
    hasToken: false,
    paramsValid: false,
    hasFreshEstimate: false,
    canExecute: false,
    isExecuting: false,
  }

  const statusOf = (
    steps: ReturnType<typeof deriveSuggestSteps>,
    id: string,
  ): string | undefined => steps.find((step) => step.id === id)?.status

  it('returns the six ordered steps', () => {
    const steps = deriveSuggestSteps(baseFlow)
    expect(steps.map((step) => step.id)).toEqual([
      'dex',
      'token',
      'params',
      'estimate',
      'execute',
      'preview',
    ])
  })

  it('starts at the token step (DEX is the always-satisfied entry)', () => {
    const steps = deriveSuggestSteps(baseFlow)
    expect(statusOf(steps, 'dex')).toBe('complete')
    expect(statusOf(steps, 'token')).toBe('current')
    expect(statusOf(steps, 'params')).toBe('upcoming')
  })

  it('advances to params once a token is chosen', () => {
    const steps = deriveSuggestSteps({ ...baseFlow, hasToken: true })
    expect(statusOf(steps, 'token')).toBe('complete')
    expect(statusOf(steps, 'params')).toBe('current')
  })

  it('advances to estimate once the params are valid', () => {
    const steps = deriveSuggestSteps({
      ...baseFlow,
      hasToken: true,
      paramsValid: true,
    })
    expect(statusOf(steps, 'params')).toBe('complete')
    expect(statusOf(steps, 'estimate')).toBe('current')
  })

  it('advances to execute once a fresh estimate exists', () => {
    const steps = deriveSuggestSteps({
      ...baseFlow,
      hasToken: true,
      paramsValid: true,
      hasFreshEstimate: true,
    })
    expect(statusOf(steps, 'estimate')).toBe('complete')
    expect(statusOf(steps, 'execute')).toBe('current')
  })

  it('marks preview current while the execute call runs', () => {
    const steps = deriveSuggestSteps({
      hasToken: true,
      paramsValid: true,
      hasFreshEstimate: true,
      canExecute: true,
      isExecuting: true,
    })
    expect(statusOf(steps, 'execute')).toBe('complete')
    expect(statusOf(steps, 'preview')).toBe('current')
  })

  it('marks exactly one step current', () => {
    const steps = deriveSuggestSteps({ ...baseFlow, hasToken: true })
    expect(steps.filter((step) => step.status === 'current')).toHaveLength(1)
  })
})
