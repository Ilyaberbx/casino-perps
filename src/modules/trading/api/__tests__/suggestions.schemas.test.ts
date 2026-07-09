import { describe, it, expect } from 'vitest'
import {
  storedSuggestionSchema,
  estimateResultSchema,
  suggestionHistorySchema,
} from '../suggestions.schemas'
import {
  makeStoredSuggestionPayload,
  makeRawSuggestionPayload,
  makeRequestParamsPayload,
  makeEstimatePayload,
} from '../__fixtures__/suggestions'

describe('storedSuggestionSchema', () => {
  it('accepts a valid StoredSuggestion payload with ISO-8601 date strings', () => {
    const parsed = storedSuggestionSchema.parse(makeStoredSuggestionPayload())

    expect(parsed.id).toBe('sug_1')
    expect(parsed.createdAt).toBe('2026-06-14T10:00:00.000Z')
    expect(parsed.expiresAt).toBe('2026-06-14T10:05:00.000Z')
  })

  it('holds dates as plain strings — does NOT coerce to Date (client holds dates as strings)', () => {
    const parsed = storedSuggestionSchema.parse(makeStoredSuggestionPayload())

    const createdAtIsString = typeof parsed.createdAt === 'string'
    const expiresAtIsString = typeof parsed.expiresAt === 'string'
    expect(createdAtIsString).toBe(true)
    expect(expiresAtIsString).toBe(true)
    // A Date instance reads `object` under typeof — a plain ISO string never does.
    expect(parsed.createdAt).toBe('2026-06-14T10:00:00.000Z')
  })

  it('accepts any non-empty string for the date fields (no ISO validation in the schema)', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({ createdAt: 'not-a-real-date' }),
    )

    expect(result.success).toBe(true)
  })

  it('rejects a Date object for createdAt — wire shape is a string', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({ createdAt: new Date('2026-06-14T10:00:00.000Z') }),
    )

    expect(result.success).toBe(false)
  })

  it('rejects a numeric epoch for expiresAt', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({ expiresAt: 1_750_000_000_000 }),
    )

    expect(result.success).toBe(false)
  })

  it('rejects a missing required field (id)', () => {
    const payload = makeStoredSuggestionPayload()
    delete payload.id
    const result = storedSuggestionSchema.safeParse(payload)

    expect(result.success).toBe(false)
  })

  it('rejects a numeric costPaidUsd — it must be a string', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({ costPaidUsd: 0.05 }),
    )

    expect(result.success).toBe(false)
  })

  it('accepts a neutral ("no-trade") side with null stop-loss / take-profit', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        rawSuggestion: makeRawSuggestionPayload({
          side: 'neutral',
          stopLossPrice: null,
          takeProfitPrice: null,
        }),
      }),
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.rawSuggestion.side).toBe('neutral')
      expect(result.data.rawSuggestion.stopLossPrice).toBeNull()
      expect(result.data.rawSuggestion.takeProfitPrice).toBeNull()
    }
  })

  it('rejects an invalid nested rawSuggestion.side', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        rawSuggestion: makeRawSuggestionPayload({ side: 'sideways' }),
      }),
    )

    expect(result.success).toBe(false)
  })

  it('rejects a non-array rawSuggestion.reasons', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        rawSuggestion: makeRawSuggestionPayload({ reasons: 'momentum' }),
      }),
    )

    expect(result.success).toBe(false)
  })

  it('rejects a non-number rawSuggestion.confidence', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        rawSuggestion: makeRawSuggestionPayload({ confidence: '72' }),
      }),
    )

    expect(result.success).toBe(false)
  })

  it('accepts requestParams with only the required symbol (optional fields absent)', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({ requestParams: { symbol: 'ETH' } }),
    )

    expect(result.success).toBe(true)
  })

  it('rejects requestParams missing the required symbol', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        requestParams: makeRequestParamsPayload({ symbol: undefined }),
      }),
    )

    expect(result.success).toBe(false)
  })

  it('rejects an unknown SuggestionStyle in requestParams.style', () => {
    const result = storedSuggestionSchema.safeParse(
      makeStoredSuggestionPayload({
        requestParams: makeRequestParamsPayload({ style: 'hodling' }),
      }),
    )

    expect(result.success).toBe(false)
  })

  it('accepts each authoritative SuggestionStyle', () => {
    const styles = ['scalping', 'day-trading', 'swing-trading'] as const
    const allAccepted = styles.every(
      (style) =>
        storedSuggestionSchema.safeParse(
          makeStoredSuggestionPayload({
            requestParams: makeRequestParamsPayload({ style }),
          }),
        ).success,
    )

    expect(allAccepted).toBe(true)
  })
})

describe('estimateResultSchema', () => {
  it('accepts a valid EstimateResult payload', () => {
    const parsed = estimateResultSchema.parse(makeEstimatePayload())

    expect(parsed).toEqual({
      costUsd: '0.05',
      agentBalanceUsd: '12.34',
      sufficient: true,
    })
  })

  it('keeps the USD figures as strings', () => {
    const parsed = estimateResultSchema.parse(makeEstimatePayload())

    expect(typeof parsed.costUsd).toBe('string')
    expect(typeof parsed.agentBalanceUsd).toBe('string')
  })

  it('rejects a missing field (sufficient)', () => {
    const result = estimateResultSchema.safeParse({
      costUsd: '0.05',
      agentBalanceUsd: '12.34',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a numeric costUsd — it must be a string', () => {
    const result = estimateResultSchema.safeParse(makeEstimatePayload({ costUsd: 0.05 }))

    expect(result.success).toBe(false)
  })

  it('rejects a string "true" for sufficient — it must be a boolean', () => {
    const result = estimateResultSchema.safeParse(
      makeEstimatePayload({ sufficient: 'true' }),
    )

    expect(result.success).toBe(false)
  })
})

describe('suggestionHistorySchema', () => {
  it('accepts an empty history', () => {
    const parsed = suggestionHistorySchema.parse({ history: [] })

    expect(parsed.history).toEqual([])
  })

  it('accepts a populated history of valid rows', () => {
    const parsed = suggestionHistorySchema.parse({
      history: [makeStoredSuggestionPayload({ id: 'a' }), makeStoredSuggestionPayload({ id: 'b' })],
    })

    expect(parsed.history).toHaveLength(2)
  })

  it('rejects a body missing the history key', () => {
    const result = suggestionHistorySchema.safeParse({ rows: [] })

    expect(result.success).toBe(false)
  })

  it('rejects a bare array (not wrapped in {history})', () => {
    const result = suggestionHistorySchema.safeParse([makeStoredSuggestionPayload()])

    expect(result.success).toBe(false)
  })

  it('rejects a history containing a malformed row', () => {
    const result = suggestionHistorySchema.safeParse({
      history: [makeStoredSuggestionPayload(), makeStoredSuggestionPayload({ id: 123 })],
    })

    expect(result.success).toBe(false)
  })
})
