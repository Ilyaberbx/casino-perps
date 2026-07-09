import { Result, type ResultAsync } from 'neverthrow'
import { ParseError, type ApiClient, type HttpError } from '@/modules/shared/http'
import { suggestionMarketsSchema } from './suggestions.schemas'
import type {
  SuggestionMarketsResult,
  SuggestionVenueId,
} from './suggestions.types'

const parseMarkets = Result.fromThrowable(
  (raw: unknown): SuggestionMarketsResult => suggestionMarketsSchema.parse(raw),
  (cause): HttpError => new ParseError('markets response failed to parse', cause),
)

/**
 * Read the server-advertised token allowlist for a DEX (slice 03/05). Thin
 * wrapper over the shared `apiClient` (http.md) — no transport here. The sheet
 * intersects this with the venue's own `listMarkets()` so the client never offers
 * a symbol the server would 422 on. `GET /api/suggestions/markets?venueId=` →
 * `{ venueId, symbols }`.
 */
export function getSuggestionMarkets(
  client: ApiClient,
  venueId: SuggestionVenueId,
): ResultAsync<SuggestionMarketsResult, HttpError> {
  const query = new URLSearchParams({ venueId }).toString()
  return client
    .get<unknown>(`/api/suggestions/markets?${query}`)
    .andThen((raw) => parseMarkets(raw))
}

export type GetSuggestionMarkets = (
  venueId: SuggestionVenueId,
) => ResultAsync<SuggestionMarketsResult, HttpError>

export function resolveDefaultGetSuggestionMarkets(
  client: ApiClient,
): GetSuggestionMarkets {
  return (venueId) => getSuggestionMarkets(client, venueId)
}
