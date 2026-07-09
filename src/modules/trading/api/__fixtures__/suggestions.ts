import { http, HttpResponse } from 'msw'
import type { JsonBodyType } from 'msw'
import { createApiClient } from '@/modules/shared/http'
import type { ApiClient } from '@/modules/shared/http'

/**
 * Test fixtures for the routed-suggestion API wrappers (ADR-0048 slice 09).
 *
 * Mirrors the established MSW-2 + apiClient construction pattern from
 * `shared/http/__tests__/api-client.test.ts`: a `BASE` url is passed to
 * `createApiClient`, `getAccessToken` resolves a static jwt, and MSW intercepts
 * the axios transport. Builders produce the over-the-wire JSON shapes the Zod
 * schemas parse against — note dates cross the wire as ISO-8601 strings.
 */

export const SUGGESTIONS_BASE = 'http://api.test'

const STORED_SUGGESTION_PATH = '/api/suggestions'
const ESTIMATE_PATH = '/api/suggestions/estimate'
const HISTORY_PATH = '/api/suggestions/history'
const MARKETS_PATH = '/api/suggestions/markets'
const INBOX_PATH = '/api/suggestions/inbox'

export function buildSuggestionsApiClient(token: string | null = 'jwt'): ApiClient {
  return createApiClient({
    getAccessToken: async () => token,
    baseUrl: SUGGESTIONS_BASE,
  })
}

/** A valid `SuggestionParams` JSON payload (the optional fields are present). */
export function makeRequestParamsPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    symbol: 'BTC',
    style: 'day-trading',
    marginUsd: 100,
    leverage: 5,
    ...overrides,
  }
}

/** A valid `RawSuggestion` JSON payload. */
export function makeRawSuggestionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    side: 'long',
    confidence: 72,
    entryPrice: 64_000,
    stopLossPrice: 62_500,
    takeProfitPrice: 68_000,
    reasons: ['momentum is up', 'volume confirms'],
    risks: ['macro print tomorrow'],
    ...overrides,
  }
}

/**
 * A valid `StoredSuggestion` JSON payload. `createdAt` / `expiresAt` are ISO-8601
 * STRINGS over the wire — the client holds dates as strings (suggestions.types.ts).
 */
export function makeStoredSuggestionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'sug_1',
    agentId: 'minara',
    requestParams: makeRequestParamsPayload(),
    rawSuggestion: makeRawSuggestionPayload(),
    costPaidUsd: '0.05',
    createdAt: '2026-06-14T10:00:00.000Z',
    expiresAt: '2026-06-14T10:05:00.000Z',
    ...overrides,
  }
}

/**
 * A valid `POST /api/suggestions` 202 accept payload (ADR-0073). Defaults to the
 * durable async path (`status: 'pending'`, `suggestion: null`); pass `completed`
 * + a suggestion payload for the dedup-hit path.
 */
export function makeAcceptPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    suggestionId: 'sug_1',
    status: 'pending',
    suggestion: null,
    ...overrides,
  }
}

/** One `GET /api/suggestions/inbox` row payload (ADR-0073). */
export function makeInboxItemPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'sug_1',
    status: 'completed',
    agentId: 'minara',
    symbol: 'BTC',
    style: 'day-trading',
    createdAt: '2026-06-14T10:00:00.000Z',
    resolvedAt: '2026-06-14T10:01:00.000Z',
    failureReason: null,
    ...overrides,
  }
}

/** A valid `EstimateResult` JSON payload. */
export function makeEstimatePayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    costUsd: '0.05',
    agentBalanceUsd: '12.34',
    sufficient: true,
    ...overrides,
  }
}

/** A valid routed request body shared by `/estimate` and `POST /api/suggestions`. */
export function makeRoutedRequest(): {
  agentId: string
  venueId: 'hyperliquid'
  params: { symbol: string; style: 'day-trading'; marginUsd: number; leverage: number }
} {
  return {
    agentId: 'minara',
    venueId: 'hyperliquid',
    params: { symbol: 'BTC', style: 'day-trading', marginUsd: 100, leverage: 5 },
  }
}

type CapturedRequest = {
  body: unknown
  authorization: string | null
  contentType: string | null
}

export type RequestRecorder = {
  readonly handler: ReturnType<typeof http.post>
  last(): CapturedRequest | undefined
  count(): number
}

/** POST `/api/suggestions/estimate` responding 200 with `body`, recording requests. */
export function estimateOkHandler(body: JsonBodyType): RequestRecorder {
  return recordingPostHandler(ESTIMATE_PATH, body)
}

/** POST `/api/suggestions` responding 200 with `body`, recording requests. */
export function executeOkHandler(body: JsonBodyType): RequestRecorder {
  return recordingPostHandler(STORED_SUGGESTION_PATH, body)
}

function recordingPostHandler(path: string, body: JsonBodyType): RequestRecorder {
  const captured: CapturedRequest[] = []
  const handler = http.post(`${SUGGESTIONS_BASE}${path}`, async ({ request }) => {
    captured.push({
      body: await request.json(),
      authorization: request.headers.get('authorization'),
      contentType: request.headers.get('content-type'),
    })
    return HttpResponse.json(body)
  })
  return {
    handler,
    last: () => captured.at(-1),
    count: () => captured.length,
  }
}

/** POST `/api/suggestions/estimate` responding with an arbitrary status + text body. */
export function estimateErrorHandler(status: number, text = 'boom') {
  return http.post(
    `${SUGGESTIONS_BASE}${ESTIMATE_PATH}`,
    () => new HttpResponse(text, { status }),
  )
}

/** POST `/api/suggestions` responding with an arbitrary status + text body. */
export function executeErrorHandler(status: number, text = 'boom') {
  return http.post(
    `${SUGGESTIONS_BASE}${STORED_SUGGESTION_PATH}`,
    () => new HttpResponse(text, { status }),
  )
}

/** GET `/api/suggestions/history` responding 200 with `{ history }`. */
export function historyOkHandler(history: readonly JsonBodyType[]) {
  return http.get(`${SUGGESTIONS_BASE}${HISTORY_PATH}`, () =>
    HttpResponse.json({ history }),
  )
}

/** GET `/api/suggestions/history` responding 200 with an arbitrary raw body. */
export function historyRawHandler(body: JsonBodyType) {
  return http.get(`${SUGGESTIONS_BASE}${HISTORY_PATH}`, () => HttpResponse.json(body))
}

/** GET `/api/suggestions/history` responding with an arbitrary status + text body. */
export function historyErrorHandler(status: number, text = 'boom') {
  return http.get(
    `${SUGGESTIONS_BASE}${HISTORY_PATH}`,
    () => new HttpResponse(text, { status }),
  )
}

/** A valid `MarketsResponse` JSON payload. */
export function makeMarketsPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    venueId: 'hyperliquid',
    symbols: ['BTC', 'ETH', 'SOL'],
    ...overrides,
  }
}

type CapturedQuery = {
  venueId: string | null
  authorization: string | null
}

export type QueryRecorder = {
  readonly handler: ReturnType<typeof http.get>
  last(): CapturedQuery | undefined
  count(): number
}

/** GET `/api/suggestions/markets` responding 200 with `body`, recording the query. */
export function marketsOkHandler(body: JsonBodyType): QueryRecorder {
  const captured: CapturedQuery[] = []
  const handler = http.get(`${SUGGESTIONS_BASE}${MARKETS_PATH}`, ({ request }) => {
    const url = new URL(request.url)
    captured.push({
      venueId: url.searchParams.get('venueId'),
      authorization: request.headers.get('authorization'),
    })
    return HttpResponse.json(body)
  })
  return {
    handler,
    last: () => captured.at(-1),
    count: () => captured.length,
  }
}

/** GET `/api/suggestions/markets` responding with an arbitrary status + text body. */
export function marketsErrorHandler(status: number, text = 'boom') {
  return http.get(
    `${SUGGESTIONS_BASE}${MARKETS_PATH}`,
    () => new HttpResponse(text, { status }),
  )
}

/** GET `/api/suggestions/inbox` responding 200 with `{ items }`. */
export function inboxOkHandler(items: readonly JsonBodyType[]) {
  return http.get(`${SUGGESTIONS_BASE}${INBOX_PATH}`, () =>
    HttpResponse.json({ items }),
  )
}

/** GET `/api/suggestions/inbox` responding 200 with an arbitrary raw body. */
export function inboxRawHandler(body: JsonBodyType) {
  return http.get(`${SUGGESTIONS_BASE}${INBOX_PATH}`, () => HttpResponse.json(body))
}

/** GET `/api/suggestions/inbox` responding with an arbitrary status + text body. */
export function inboxErrorHandler(status: number, text = 'boom') {
  return http.get(
    `${SUGGESTIONS_BASE}${INBOX_PATH}`,
    () => new HttpResponse(text, { status }),
  )
}
