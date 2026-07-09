import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { StatusCodes } from 'http-status-codes'
import { ApiError, ParseError } from '@/modules/shared/http'
import {
  getSuggestionInbox,
  resolveDefaultGetSuggestionInbox,
} from '../get-suggestion-inbox'
import {
  buildSuggestionsApiClient,
  inboxErrorHandler,
  inboxOkHandler,
  inboxRawHandler,
  makeInboxItemPayload,
} from '../__fixtures__/suggestions'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('getSuggestionInbox', () => {
  it('GETs /api/suggestions/inbox and returns the parsed items', async () => {
    server.use(
      inboxOkHandler([
        makeInboxItemPayload({ id: 'a', status: 'completed' }),
        makeInboxItemPayload({ id: 'b', status: 'pending', resolvedAt: null }),
        makeInboxItemPayload({
          id: 'c',
          status: 'failed',
          failureReason: 'recovery-uncertain',
        }),
      ]),
    )
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    const items = result._unsafeUnwrap()
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ id: 'a', status: 'completed', symbol: 'BTC' })
    expect(items[1]).toMatchObject({ id: 'b', status: 'pending', resolvedAt: null })
    expect(items[2]).toMatchObject({ id: 'c', status: 'failed', failureReason: 'recovery-uncertain' })
  })

  it('returns an empty list when the inbox is empty', async () => {
    server.use(inboxOkHandler([]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('accepts a null style and a null failureReason', async () => {
    server.use(
      inboxOkHandler([makeInboxItemPayload({ style: null, failureReason: null })]),
    )
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    expect(result._unsafeUnwrap()[0].style).toBeNull()
  })

  it('maps a malformed body (missing items) to ParseError', async () => {
    server.use(inboxRawHandler({ nope: true }))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a bad status enum to ParseError', async () => {
    server.use(inboxOkHandler([makeInboxItemPayload({ status: 'queued' })]))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ParseError)
  })

  it('maps a non-2xx response to ApiError', async () => {
    server.use(inboxErrorHandler(StatusCodes.INTERNAL_SERVER_ERROR))
    const client = buildSuggestionsApiClient()

    const result = await getSuggestionInbox(client)

    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ApiError)
  })
})

describe('resolveDefaultGetSuggestionInbox', () => {
  it('returns a bound reader that GETs and parses', async () => {
    server.use(inboxOkHandler([makeInboxItemPayload()]))
    const client = buildSuggestionsApiClient()

    const getInbox = resolveDefaultGetSuggestionInbox(client)
    const result = await getInbox()

    expect(result._unsafeUnwrap()).toHaveLength(1)
  })
})
