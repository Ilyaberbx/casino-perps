/**
 * Client mirror of the server routed-suggestion contract (ADR-0048). The server
 * routes to ONE agent and returns that agent's raw suggestion — there is no
 * ensemble outcome union. These are the response shapes the `trading/api`
 * wrappers Zod-parse against; the AI sheet + preview render off them. `Date`
 * fields arrive as ISO-8601 strings over the wire.
 */

/**
 * The agent's own direction (no cross-provider conflict under routing).
 * `neutral` is a "no-trade" outcome — the agent advises against a position, so a
 * neutral suggestion has no exit levels and is not executable as an order
 * (ADR-0048 addendum).
 */
export type SuggestionSide = 'long' | 'short' | 'neutral'

/**
 * The DEX a suggestion targets (slice 04, server contract from slice 03). The
 * server defaults to `hyperliquid`; `extended` is roadmap-only (coming soon).
 * Distinct from the app-level `VenueId` (`mock | hyperliquid`) — this scopes the
 * suggestion, not the global venue switcher.
 */
export type SuggestionVenueId = 'hyperliquid' | 'extended'

/** Minara's trading-style horizons (authoritative — minara.ai/docs). */
export type SuggestionStyle = 'scalping' | 'day-trading' | 'swing-trading'

/** The per-request params the trader configures for the selected agent. */
export interface SuggestionParams {
  readonly symbol: string
  readonly style?: SuggestionStyle
  readonly marginUsd?: number
  readonly leverage?: number
}

/**
 * One agent's raw suggestion, shown unchanged (confidence 0–100, ADR-0048 D-1).
 * A `neutral` ("no-trade") suggestion carries no exit levels, so `stopLossPrice`
 * / `takeProfitPrice` are `number | null` (ADR-0048 addendum).
 */
export interface RawSuggestion {
  readonly side: SuggestionSide
  readonly confidence: number
  readonly entryPrice: number
  readonly stopLossPrice: number | null
  readonly takeProfitPrice: number | null
  readonly reasons: readonly string[]
  readonly risks: readonly string[]
}

/**
 * One persisted/returned suggestion (ADR-0048 D-1/D-4): the `POST /api/suggestions`
 * response and a history row. Within `expiresAt` it is reusable + executable;
 * past it, read-only.
 */
export interface StoredSuggestion {
  readonly id: string
  readonly agentId: string
  readonly requestParams: SuggestionParams
  readonly rawSuggestion: RawSuggestion
  readonly costPaidUsd: string
  readonly createdAt: string
  readonly expiresAt: string
}

/** The `/estimate` response: cost, balance, and whether the balance covers it. */
export interface EstimateResult {
  readonly costUsd: string
  readonly agentBalanceUsd: string
  readonly sufficient: boolean
}

/**
 * The lifecycle status of a suggestion row (ADR-0073 D-4). A `pending` job is
 * in flight; `completed` carries a usable suggestion; `failed` carries a
 * `failureReason`. The history list shows `completed` only — `pending`/`failed`
 * rows are visible solely through the inbox poll feed.
 */
export type SuggestionStatus = 'pending' | 'completed' | 'failed'

/**
 * One row of the `GET /api/suggestions/inbox` poll feed (ADR-0073 D-5): the
 * actor's suggestion rows from the last ~24h regardless of status. The client
 * inbox provider diffs these to fire a toast when a watched id resolves and to
 * reconcile in-flight work on boot. `resolvedAt` / `failureReason` are set only
 * once the row leaves `pending`.
 */
export interface SuggestionOutcome {
  readonly id: string
  readonly status: SuggestionStatus
  readonly agentId: string
  readonly symbol: string
  readonly style: string | null
  readonly createdAt: string
  readonly resolvedAt: string | null
  readonly failureReason: string | null
}

/**
 * The `POST /api/suggestions` 202 acceptor response (ADR-0073 D-1). A genuine
 * miss enqueues a durable job and returns `status: 'pending'` with a null
 * suggestion — the client registers the id and waits for a toast. A `completed`
 * dedup hit returns the cached `StoredSuggestion` immediately (no waiting).
 */
export type AcceptSuggestionResult =
  | { readonly status: 'pending'; readonly suggestionId: string }
  | {
      readonly status: 'completed'
      readonly suggestionId: string
      readonly suggestion: StoredSuggestion
    }

/** The routed request body shared by `/estimate` and `POST /api/suggestions`. */
export interface RoutedSuggestionRequest {
  readonly agentId: string
  /** The DEX the suggestion is scoped to (slice 04). Defaults to `hyperliquid`. */
  readonly venueId: SuggestionVenueId
  readonly params: SuggestionParams
}

/**
 * The `GET /api/suggestions/markets?venueId=` response (slice 03/05): the venue
 * and the exact symbol allowlist the validate-before-pay gate accepts for it. The
 * sheet intersects this with the venue's own `listMarkets()` so the client never
 * offers a symbol the server would 422 on.
 */
export interface SuggestionMarketsResult {
  readonly venueId: SuggestionVenueId
  readonly symbols: readonly string[]
}
