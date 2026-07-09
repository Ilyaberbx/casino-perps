import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { StatusCodes } from 'http-status-codes'
import { ApiError, ParseError } from '@/modules/shared/http'
import {
  executeSuggestion,
  resolveDefaultExecuteSuggestion,
} from '../execute-suggestion'
import {
  buildSuggestionsApiClient,
  executeOkHandler,
  executeErrorHandler,
  makeAcceptPayload,
  makeStoredSuggestionPayload,
  makeRoutedRequest,
} from '../__fixtures__/suggestions'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('executeSuggestion — async accept (ADR-0073)', () => {
  it('POSTs {agentId, params} to /api/suggestions and returns a pending accept', async () => {
    const recorder = executeOkHandler(makeAcceptPayload({ suggestionId: 'sug_42' }))
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result.isOk()).toBe(true)
    const accepted = result._unsafeUnwrap()
    expect(accepted.status).toBe('pending')
    expect(accepted.suggestionId).toBe('sug_42')
    expect(recorder.count()).toBe(1)
    expect(recorder.last()?.body).toEqual({
      agentId: 'minara',
      params: { symbol: 'BTC', style: 'day-trading', marginUsd: 100, leverage: 5, venueId: 'hyperliquid' },
    })
  })

  it('returns the cached StoredSuggestion inline on a completed dedup hit', async () => {
    server.use(
      executeOkHandler(
        makeAcceptPayload({
          status: 'completed',
          suggestion: makeStoredSuggestionPayload(),
        }),
      ).handler,
    )
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    const accepted = result._unsafeUnwrap()
    expect(accepted.status).toBe('completed')
    // Narrow to the completed variant to read the suggestion.
    if (accepted.status !== 'completed') throw new Error('expected completed')
    expect(accepted.suggestion.id).toBe('sug_1')
    expect(accepted.suggestion.rawSuggestion.side).toBe('long')
    expect(typeof accepted.suggestion.createdAt).toBe('string')
  })

  it('treats a completed status with a null suggestion as pending (defensive)', async () => {
    server.use(
      executeOkHandler(makeAcceptPayload({ status: 'completed', suggestion: null })).handler,
    )
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrap().status).toBe('pending')
  })

  it('maps a non-2xx response to ApiError carrying the status', async () => {
    server.use(executeErrorHandler(StatusCodes.PAYMENT_REQUIRED))
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ApiError)
    const isApiError = error instanceof ApiError
    expect(isApiError && error.status).toBe(StatusCodes.PAYMENT_REQUIRED)
  })

  it('maps a 500 response to ApiError', async () => {
    server.use(executeErrorHandler(StatusCodes.INTERNAL_SERVER_ERROR))
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })

  it('maps a malformed 202 body (missing suggestionId) to ParseError', async () => {
    const payload = makeAcceptPayload()
    delete payload.suggestionId
    server.use(executeOkHandler(payload).handler)
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a malformed completed suggestion (bad nested side) to ParseError', async () => {
    server.use(
      executeOkHandler(
        makeAcceptPayload({
          status: 'completed',
          suggestion: makeStoredSuggestionPayload({
            rawSuggestion: { side: 'sideways' },
          }),
        }),
      ).handler,
    )
    const client = buildSuggestionsApiClient()

    const result = await executeSuggestion(client, makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })
})

describe('resolveDefaultExecuteSuggestion', () => {
  it('returns a bound ExecuteSuggestion that POSTs and parses the 202', async () => {
    const recorder = executeOkHandler(makeAcceptPayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()

    const execute = resolveDefaultExecuteSuggestion(client)
    const result = await execute(makeRoutedRequest())

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().suggestionId).toBe('sug_1')
    expect(recorder.last()?.body).toEqual({
      agentId: 'minara',
      params: { symbol: 'BTC', style: 'day-trading', marginUsd: 100, leverage: 5, venueId: 'hyperliquid' },
    })
  })

  it('propagates the ParseError branch through the bound function', async () => {
    server.use(executeOkHandler({ nope: true }).handler)
    const client = buildSuggestionsApiClient()

    const execute = resolveDefaultExecuteSuggestion(client)
    const result = await execute(makeRoutedRequest())

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })
})
