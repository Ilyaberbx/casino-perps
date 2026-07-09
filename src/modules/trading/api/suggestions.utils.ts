import type { RoutedSuggestionRequest, SuggestionParams } from './suggestions.types'
import type { SuggestionVenueId } from './suggestions.types'

/**
 * Project the client's routed request (venueId as a top-level scope) into the
 * exact wire body the server's `routedSuggestionSchema` expects: `{ agentId,
 * params }`, with `venueId` nested INSIDE `params` (`suggestionParamsSchema`).
 *
 * The server reads `params.venueId`; a top-level `venueId` is an unknown key that
 * Zod strips, so it would be silently dropped and default to `hyperliquid`. This
 * mapping is the api-wrapper's job (http.md) — pure, no transport.
 */
export function toRoutedBody(request: RoutedSuggestionRequest): {
  agentId: string
  params: SuggestionParams & { venueId: SuggestionVenueId }
} {
  return {
    agentId: request.agentId,
    params: { ...request.params, venueId: request.venueId },
  }
}
