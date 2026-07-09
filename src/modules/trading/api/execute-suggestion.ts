import { Result, type ResultAsync } from 'neverthrow'
import { ParseError, type ApiClient, type HttpError } from '@/modules/shared/http'
import { acceptSuggestionSchema } from './suggestions.schemas'
import { toRoutedBody } from './suggestions.utils'
import type {
  AcceptSuggestionResult,
  RoutedSuggestionRequest,
} from './suggestions.types'

const parseAccept = Result.fromThrowable(
  (raw: unknown): AcceptSuggestionResult => {
    const body = acceptSuggestionSchema.parse(raw)
    if (body.status === 'completed' && body.suggestion !== null) {
      return {
        status: 'completed',
        suggestionId: body.suggestionId,
        suggestion: body.suggestion,
      }
    }
    return { status: 'pending', suggestionId: body.suggestionId }
  },
  (cause): HttpError => new ParseError('suggestion response failed to parse', cause),
)

/**
 * Accept one routed paid call (ADR-0073 D-1). The server returns `202` after
 * enqueuing a durable job: `status: 'pending'` (register the id, wait for the
 * inbox toast) or, on a `completed` dedup hit, the cached `StoredSuggestion`
 * inline (no waiting). Thin wrapper over the shared `apiClient` (http.md);
 * `venueId` is nested into `params` to match the server contract (`toRoutedBody`).
 */
export function executeSuggestion(
  client: ApiClient,
  request: RoutedSuggestionRequest,
): ResultAsync<AcceptSuggestionResult, HttpError> {
  return client
    .post<unknown>('/api/suggestions', toRoutedBody(request))
    .andThen((raw) => parseAccept(raw))
}

export type ExecuteSuggestion = (
  request: RoutedSuggestionRequest,
) => ResultAsync<AcceptSuggestionResult, HttpError>

export function resolveDefaultExecuteSuggestion(
  client: ApiClient,
): ExecuteSuggestion {
  return (request) => executeSuggestion(client, request)
}
