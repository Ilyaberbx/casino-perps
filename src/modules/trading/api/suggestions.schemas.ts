import { z } from 'zod'

/**
 * Zod schemas the routed-suggestion wrappers parse responses against (ADR-0048).
 * A malformed body surfaces as a `ParseError` rather than mis-rendering the AI
 * sheet. Shared by the estimate / execute / history wrappers.
 */

const suggestionParamsSchema = z.object({
  symbol: z.string(),
  style: z.enum(['scalping', 'day-trading', 'swing-trading']).optional(),
  marginUsd: z.number().optional(),
  leverage: z.number().optional(),
})

const rawSuggestionSchema = z.object({
  // `neutral` is a "no-trade" outcome with no exit levels — SL/TP are nullable
  // (ADR-0048 addendum). A neutral suggestion renders as non-executable.
  side: z.union([z.literal('long'), z.literal('short'), z.literal('neutral')]),
  confidence: z.number(),
  entryPrice: z.number(),
  stopLossPrice: z.number().nullable(),
  takeProfitPrice: z.number().nullable(),
  reasons: z.array(z.string()),
  risks: z.array(z.string()),
})

export const storedSuggestionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  requestParams: suggestionParamsSchema,
  rawSuggestion: rawSuggestionSchema,
  costPaidUsd: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
})

export const estimateResultSchema = z.object({
  costUsd: z.string(),
  agentBalanceUsd: z.string(),
  sufficient: z.boolean(),
})

export const suggestionHistorySchema = z.object({
  history: z.array(storedSuggestionSchema),
})

export const suggestionMarketsSchema = z.object({
  venueId: z.union([z.literal('hyperliquid'), z.literal('extended')]),
  symbols: z.array(z.string()),
})

const suggestionStatusSchema = z.union([
  z.literal('pending'),
  z.literal('completed'),
  z.literal('failed'),
])

/**
 * The `POST /api/suggestions` 202 acceptor body (ADR-0073 D-1): the job id, its
 * status, and the cached suggestion on a `completed` dedup hit (null otherwise).
 */
export const acceptSuggestionSchema = z.object({
  suggestionId: z.string(),
  status: z.union([z.literal('pending'), z.literal('completed')]),
  suggestion: storedSuggestionSchema.nullable(),
})

/**
 * The `GET /api/suggestions/inbox` poll feed (ADR-0073 D-5): the actor's rows
 * from the last ~24h across all statuses. The client diffs these to toast on
 * resolution and reconcile in-flight work on boot.
 */
export const suggestionInboxSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: suggestionStatusSchema,
      agentId: z.string(),
      symbol: z.string(),
      style: z.string().nullable(),
      createdAt: z.string(),
      resolvedAt: z.string().nullable(),
      failureReason: z.string().nullable(),
    }),
  ),
})
