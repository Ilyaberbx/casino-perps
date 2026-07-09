import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { StatusCodes } from 'http-status-codes'
import { ApiError, ParseError } from '@/modules/shared/http'
import {
  getSuggestionMarkets,
  resolveDefaultGetSuggestionMarkets,
} from '../get-suggestion-markets'
import {
  buildSuggestionsApiClient,
  makeMarketsPayload,
  marketsOkHandler,
  marketsErrorHandler,
} from '../__fixtures__/suggestions'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('getSuggestionMarkets', () => {
  it('GETs /api/suggestions/markets?venueId= and returns ok(SuggestionMarketsResult) on 200', async () => {
    const recorder = marketsOkHandler(makeMarketsPayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionMarkets(client, 'hyperliquid')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      venueId: 'hyperliquid',
      symbols: ['BTC', 'ETH', 'SOL'],
    })
    expect(recorder.count()).toBe(1)
    expect(recorder.last()?.venueId).toBe('hyperliquid')
  })

  it('sends the Privy bearer token attached by the shared transport', async () => {
    const recorder = marketsOkHandler(makeMarketsPayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient('jwt-markets')

    await getSuggestionMarkets(client, 'hyperliquid')

    expect(recorder.last()?.authorization).toBe('Bearer jwt-markets')
  })

  it('maps a non-2xx response to ApiError carrying the status', async () => {
    server.use(marketsErrorHandler(StatusCodes.BAD_REQUEST))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionMarkets(client, 'hyperliquid')

    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error).toBeInstanceOf(ApiError)
    const isApiError = error instanceof ApiError
    expect(isApiError && error.status).toBe(StatusCodes.BAD_REQUEST)
  })

  it('maps a malformed 200 body (missing symbols) to ParseError', async () => {
    server.use(marketsOkHandler({ venueId: 'hyperliquid' }).handler)
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionMarkets(client, 'hyperliquid')

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a malformed 200 body (wrong symbols type) to ParseError', async () => {
    server.use(
      marketsOkHandler(makeMarketsPayload({ symbols: 'BTC' })).handler,
    )
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionMarkets(client, 'hyperliquid')

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })
})

describe('resolveDefaultGetSuggestionMarkets', () => {
  it('returns a bound GetSuggestionMarkets that GETs and parses on 200', async () => {
    const recorder = marketsOkHandler(makeMarketsPayload())
    server.use(recorder.handler)
    const client = buildSuggestionsApiClient()

    const getMarkets = resolveDefaultGetSuggestionMarkets(client)
    const result = await getMarkets('hyperliquid')

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().symbols).toEqual(['BTC', 'ETH', 'SOL'])
    expect(recorder.last()?.venueId).toBe('hyperliquid')
  })

  it('propagates the ApiError branch through the bound function', async () => {
    server.use(marketsErrorHandler(StatusCodes.INTERNAL_SERVER_ERROR))
    const client = buildSuggestionsApiClient()

    const getMarkets = resolveDefaultGetSuggestionMarkets(client)
    const result = await getMarkets('hyperliquid')

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })
})
