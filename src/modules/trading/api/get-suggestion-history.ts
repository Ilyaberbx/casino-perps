import { Result, type ResultAsync } from 'neverthrow'
import { ParseError, type ApiClient, type HttpError } from '@/modules/shared/http'
import { suggestionHistorySchema } from './suggestions.schemas'
import type { StoredSuggestion } from './suggestions.types'

const parseHistory = Result.fromThrowable(
  (raw: unknown): readonly StoredSuggestion[] =>
    suggestionHistorySchema.parse(raw).history,
  (cause): HttpError => new ParseError('history response failed to parse', cause),
)

/**
 * Read the actor's aggregated suggestion history (ADR-0048 D-4): all agents'
 * rows, newest-first, each agent-tagged. Server-cached (Redis) so the History
 * tab opens instantly. Thin wrapper over the shared `apiClient` (http.md).
 * `GET /api/suggestions/history` → `{ history }`.
 */
export function getSuggestionHistory(
  client: ApiClient,
): ResultAsync<readonly StoredSuggestion[], HttpError> {
  return client
    .get<unknown>('/api/suggestions/history')
    .andThen((raw) => parseHistory(raw))
}

export type GetSuggestionHistory = () => ResultAsync<
  readonly StoredSuggestion[],
  HttpError
>

export function resolveDefaultGetSuggestionHistory(
  client: ApiClient,
): GetSuggestionHistory {
  return () => getSuggestionHistory(client)
}
