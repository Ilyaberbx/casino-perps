import { describe, it, expect } from 'vitest'
import {
  hasPending,
  mapFailureReason,
  selectPendingToasts,
} from '../suggestion-inbox-provider.utils'
import type { SuggestionOutcome } from '../../../api/suggestions.types'

function outcome(overrides: Partial<SuggestionOutcome> = {}): SuggestionOutcome {
  return {
    id: 'a',
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

describe('hasPending', () => {
  it('is true when any row is pending', () => {
    expect(hasPending([outcome({ status: 'completed' }), outcome({ status: 'pending' })])).toBe(true)
  })

  it('is false when every row is resolved', () => {
    expect(hasPending([outcome({ status: 'completed' }), outcome({ status: 'failed' })])).toBe(false)
  })

  it('is false for an empty inbox', () => {
    expect(hasPending([])).toBe(false)
  })
})

describe('selectPendingToasts', () => {
  it('selects only watched, resolved, unacknowledged outcomes', () => {
    const items = [
      outcome({ id: 'watched-done', status: 'completed' }),
      outcome({ id: 'watched-pending', status: 'pending' }),
      outcome({ id: 'unwatched-done', status: 'completed' }),
      outcome({ id: 'watched-acked', status: 'failed', failureReason: 'x' }),
    ]
    const watched = new Set(['watched-done', 'watched-pending', 'watched-acked'])
    const acked = new Set(['watched-acked'])

    const toasts = selectPendingToasts(items, watched, acked)

    expect(toasts.map((t) => t.id)).toEqual(['watched-done'])
    expect(toasts[0].status).toBe('completed')
    expect(toasts[0].symbol).toBe('BTC')
  })

  it('surfaces a failed outcome with its failure reason', () => {
    const items = [outcome({ id: 'f', status: 'failed', failureReason: 'recovery-uncertain' })]
    const toasts = selectPendingToasts(items, new Set(['f']), new Set())

    expect(toasts[0]).toMatchObject({ status: 'failed', failureReason: 'recovery-uncertain' })
  })

  it('toasts an outcome resolved while away (watched, never acked)', () => {
    const items = [outcome({ id: 'away', status: 'completed' })]
    const toasts = selectPendingToasts(items, new Set(['away']), new Set())
    expect(toasts).toHaveLength(1)
  })
})

describe('mapFailureReason', () => {
  it('maps the recovery-uncertain sentinel to a contact-support line', () => {
    expect(mapFailureReason('recovery-uncertain')).toMatch(/contact support/i)
  })

  it('maps InsufficientAgentBalance to an actionable top-up line', () => {
    expect(mapFailureReason('InsufficientAgentBalance')).toMatch(/top it up/i)
  })

  it('falls back to a generic retry hint for any other reason', () => {
    expect(mapFailureReason('timeout')).toMatch(/try again/i)
    expect(mapFailureReason(null)).toMatch(/try again/i)
  })

  it('never returns the check-your-connection copy', () => {
    expect(mapFailureReason(null)).not.toMatch(/connection/i)
    expect(mapFailureReason('recovery-uncertain')).not.toMatch(/connection/i)
  })
})
