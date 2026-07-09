import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { StatusCodes } from 'http-status-codes'
import { ApiError, ParseError } from '@/modules/shared/http'
import {
  estimateSuggestion,
  resolveDefaultEstimateSuggestion,
} from '../estimate-suggestion'
import {
  buildSuggestionsApiClient,
  estimateOkHandler,
  estimateErrorHandler,
  makeEstimatePayload,
  makeRoutedRequest,
} from '../__fixtures__/suggestions'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('estimateSuggestion', () => {
  it('POSTs {agentId, params} to /api/suggestions/estimate and returns ok(EstimateResult) on 200', async () => {
    const recorder = estimateOkHandler(makeEstimatePayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()
    const request = makeRoutedRequest()

    const result = await estimateSuggestion(client, request)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      costUsd: '0.05',
      agentBalanceUsd: '12.34',
      sufficient: true,
    })
    expect(recorder.count()).toBe(1)
    expect(recorder.last()?.body).toEqual({
      agentId: 'minara',
      params: { symbol: 'BTC', style: 'day-trading', marginUsd: 100, leverage: 5, venueId: 'hyperliquid' },
    })
  })

  it('sends the Privy bearer token attached by the shared transport', async () => {
    const recorder = estimateOkHandler(makeEstimatePayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient('jwt-est')

    await estimateSuggestion(client, makeRoutedRequest())

    expect(recorder.last()?.authorization).toBe('Bearer jwt-est')
  })

  it('returns ok with sufficient:false when the balance does not cover the cost', async () => {
    server.use(
      estimateOkHandler(
        makeEstimatePayload({ costUsd: '0.50', agentBalanceUsd: '0.10', sufficient: false }),
      ).handler,
    )
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrap()).toEqual({
      costUsd: '0.50',
      agentBalanceUsd: '0.10',
      sufficient: false,
    })
  })

  it('maps a non-2xx response to ApiError carrying the status', async () => {
    server.use(estimateErrorHandler(StatusCodes.PAYMENT_REQUIRED))
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ApiError)
    const isApiError = error instanceof ApiError
    expect(isApiError && error.status).toBe(StatusCodes.PAYMENT_REQUIRED)
  })

  it('maps a 500 response to ApiError', async () => {
    server.use(estimateErrorHandler(StatusCodes.INTERNAL_SERVER_ERROR))
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })

  it('maps a malformed 200 body (missing field) to ParseError', async () => {
    server.use(estimateOkHandler({ costUsd: '0.05', agentBalanceUsd: '12.34' }).handler)
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a malformed 200 body (wrong type) to ParseError', async () => {
    server.use(estimateOkHandler(makeEstimatePayload({ sufficient: 'yes' })).handler)
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a numeric costUsd (server should send a string) to ParseError', async () => {
    server.use(estimateOkHandler(makeEstimatePayload({ costUsd: 0.05 })).handler)
    const client = buildSuggestionsApiClient()

    const result = await estimateSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })
})

describe('resolveDefaultEstimateSuggestion', () => {
  it('returns a bound EstimateSuggestion that POSTs and parses on 200', async () => {
    const recorder = estimateOkHandler(makeEstimatePayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()

    const estimate = resolveDefaultEstimateSuggestion(client)
    const result = await estimate(makeRoutedRequest())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().sufficient).toBe(true)
    expect(recorder.last()?.body).toEqual({
      agentId: 'minara',
      params: { symbol: 'BTC', style: 'day-trading', marginUsd: 100, leverage: 5, venueId: 'hyperliquid' },
    })
  })

  it('propagates the ApiError branch through the bound function', async () => {
    server.use(estimateErrorHandler(StatusCodes.BAD_REQUEST))
    const client = buildSuggestionsApiClient()

    const estimate = resolveDefaultEstimateSuggestion(client)
    const result = await estimate(makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })
})
