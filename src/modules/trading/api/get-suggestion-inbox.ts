import { Result, type ResultAsync } from 'neverthrow'
import { ParseError, type ApiClient, type HttpError } from '@/modules/shared/http'
import { suggestionInboxSchema } from './suggestions.schemas'
import type { SuggestionOutcome } from './suggestions.types'

const parseInbox = Result.fromThrowable(
  (raw: unknown): readonly SuggestionOutcome[] =>
    suggestionInboxSchema.parse(raw).items,
  (cause): HttpError => new ParseError('inbox response failed to parse', cause),
)

/**
 * Read the actor's suggestion poll feed (ADR-0073 D-5): every row from the last
 * ~24h regardless of status, the source of truth the inbox provider diffs to
 * toast on resolution and reconcile in-flight work on boot. Thin wrapper over
 * the shared `apiClient` (http.md). `GET /api/suggestions/inbox` → `{ items }`.
 */
export function getSuggestionInbox(
  client: ApiClient,
): ResultAsync<readonly SuggestionOutcome[], HttpError> {
  return client
    .get<unknown>('/api/suggestions/inbox')
    .andThen((raw) => parseInbox(raw))
}

export type GetSuggestionInbox = () => ResultAsync<
  readonly SuggestionOutcome[],
  HttpError
>

export function resolveDefaultGetSuggestionInbox(
  client: ApiClient,
): GetSuggestionInbox {
  return () => getSuggestionInbox(client)
}
