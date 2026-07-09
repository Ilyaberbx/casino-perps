import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { StatusCodes } from 'http-status-codes'
import { ApiError, ParseError } from '@/modules/shared/http'
import {
  getSuggestionHistory,
  resolveDefaultGetSuggestionHistory,
} from '../get-suggestion-history'
import {
  buildSuggestionsApiClient,
  historyOkHandler,
  historyRawHandler,
  historyErrorHandler,
  makeStoredSuggestionPayload,
} from '../__fixtures__/suggestions'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('getSuggestionHistory', () => {
  it('GETs /api/suggestions/history and returns ok([]) for an empty history', async () => {
    server.use(historyOkHandler([]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('unwraps {history} and returns the StoredSuggestion[] for a populated history', async () => {
    const first = makeStoredSuggestionPayload({ id: 'sug_1', agentId: 'minara' })
    const second = makeStoredSuggestionPayload({ id: 'sug_2', agentId: 'native' })
    server.use(historyOkHandler([first, second]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('sug_1')
    expect(rows[1].agentId).toBe('native')
  })

  it('preserves ISO-8601 date strings on each history row', async () => {
    const createdAt = '2026-06-14T09:00:00.000Z'
    const expiresAt = '2026-06-14T09:05:00.000Z'
    server.use(
      historyOkHandler([makeStoredSuggestionPayload({ createdAt, expiresAt })]),
    )
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    const rows = result._unsafeUnwrap()
    expect(rows[0].createdAt).toBe(createdAt)
    expect(rows[0].expiresAt).toBe(expiresAt)
    expect(typeof rows[0].createdAt).toBe('string')
  })

  it('maps a non-2xx response to ApiError carrying the status', async () => {
    server.use(historyErrorHandler(StatusCodes.INTERNAL_SERVER_ERROR))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ApiError)
    const isApiError = error instanceof ApiError
    expect(isApiError && error.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR)
  })

  it('maps a body missing the history key to ParseError', async () => {
    server.use(historyRawHandler({ rows: [] }))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a history with a malformed row to ParseError', async () => {
    const bad = makeStoredSuggestionPayload({ costPaidUsd: 0.05 })
    server.use(historyOkHandler([makeStoredSuggestionPayload(), bad]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps history being a bare array (not wrapped in {history}) to ParseError', async () => {
    server.use(historyRawHandler([makeStoredSuggestionPayload()]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionHistory(client)

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })
})

describe('resolveDefaultGetSuggestionHistory', () => {
  it('returns a bound GetSuggestionHistory that GETs and unwraps on 200', async () => {
    server.use(historyOkHandler([makeStoredSuggestionPayload({ id: 'sug_9' })]))
    const client = buildSuggestionsApiClient()

    const getHistory = resolveDefaultGetSuggestionHistory(client)
    const result = await getHistory()

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()[0].id).toBe('sug_9')
  })

  it('propagates the ApiError branch through the bound function', async () => {
    server.use(historyErrorHandler(StatusCodes.NOT_FOUND))
    const client = buildSuggestionsApiClient()

    const getHistory = resolveDefaultGetSuggestionHistory(client)
    const result = await getHistory()

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })
})
