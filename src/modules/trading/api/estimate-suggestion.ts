import { Result, type ResultAsync } from 'neverthrow'
import { ParseError, type ApiClient, type HttpError } from '@/modules/shared/http'
import { estimateResultSchema } from './suggestions.schemas'
import { toRoutedBody } from './suggestions.utils'
import type {
  EstimateResult,
  RoutedSuggestionRequest,
} from './suggestions.types'

const parseEstimate = Result.fromThrowable(
  (raw: unknown): EstimateResult => estimateResultSchema.parse(raw),
  (cause): HttpError => new ParseError('estimate response failed to parse', cause),
)

/**
 * Price one routed call (ADR-0048 D-1). Thin wrapper over the shared `apiClient`
 * (http.md) — no transport here. `POST /api/suggestions/estimate { agentId,
 * params }` → `{ costUsd, agentBalanceUsd, sufficient }`. Needs no delegation.
 * The server reads `venueId` from INSIDE `params` (`suggestionParamsSchema`), so
 * the wrapper nests the scope there — a top-level `venueId` would be silently
 * dropped and default to `hyperliquid`.
 */
export function estimateSuggestion(
  client: ApiClient,
  request: RoutedSuggestionRequest,
): ResultAsync<EstimateResult, HttpError> {
  return client
    .post<unknown>('/api/suggestions/estimate', toRoutedBody(request))
    .andThen((raw) => parseEstimate(raw))
}

export type EstimateSuggestion = (
  request: RoutedSuggestionRequest,
) => ResultAsync<EstimateResult, HttpError>

export function resolveDefaultEstimateSuggestion(
  client: ApiClient,
): EstimateSuggestion {
  return (request) => estimateSuggestion(client, request)
}
