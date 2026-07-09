import { describe, it, expect } from 'vitest'
import type { OrderbookUpdate } from '../../shared/domain'
import {
  applyDiff,
  createBookState,
  updateBookState,
  samplePoisson,
  sampleAckLatencyMilliseconds,
} from '../mock-venue.utils'

describe('applyDiff', () => {
  it('merges updates, removes zero-size levels, and sorts', () => {
    const current = [
      { price: 100, size: 1 },
      { price: 99, size: 2 },
    ]
    const updates = [
      { price: 100, size: 0 }, // deletion
      { price: 98, size: 3 },
    ]
    expect(applyDiff(current, updates, true)).toEqual([
      { price: 99, size: 2 },
      { price: 98, size: 3 },
    ])
  })

  it('sorts ascending when isDescending is false', () => {
    const result = applyDiff([], [{ price: 5, size: 1 }, { price: 3, size: 1 }], false)
    expect(result.map((level) => level.price)).toEqual([3, 5])
  })
})

describe('updateBookState', () => {
  it('takes a snapshot wholesale and computes the mid price', () => {
    const update: OrderbookUpdate = {
      kind: 'snapshot',
      symbol: 'BTC-PERP',
      sequence: 1,
      timestamp: 0,
      bids: [{ price: 100, size: 1 }],
      asks: [{ price: 102, size: 1 }],
    }
    const next = updateBookState(createBookState(), update)
    expect(next.lastMidPrice).toBe(101)
    expect(next.bids).toEqual([{ price: 100, size: 1 }])
  })
})

describe('samplePoisson', () => {
  it('counts arrivals deterministically for a fixed rng', () => {
    // rng()=0.5, rate=2 → threshold e^-2≈0.135; 0.5→0.25→0.125<threshold ⇒ 2.
    expect(samplePoisson(() => 0.5, 2)).toBe(2)
  })
})

describe('sampleAckLatencyMilliseconds', () => {
  it('stays within the configured latency bounds', () => {
    expect(sampleAckLatencyMilliseconds(() => 0)).toBe(50)
    expect(sampleAckLatencyMilliseconds(() => 0.999)).toBeLessThan(150)
    expect(sampleAckLatencyMilliseconds(() => 0.999)).toBeGreaterThanOrEqual(50)
  })
})
