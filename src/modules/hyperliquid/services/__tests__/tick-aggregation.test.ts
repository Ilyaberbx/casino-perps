import { describe, it, expect } from 'vitest'
import {
  bucketLevels,
  inferAutoTick,
  resolveTick,
  tickToL2BookAggregation,
} from '../tick-aggregation'

describe('inferAutoTick', () => {
  // STAB-06: 'auto' must NOT bucket — the old mark-price ladder collapsed a
  // tight HL book into 1-2 levels. 0 = native-passthrough sentinel.
  it('always returns 0 (native passthrough — no mark-price ladder)', () => {
    expect(inferAutoTick()).toBe(0)
  })
})

describe('resolveTick', () => {
  it('passes concrete choices through', () => {
    expect(resolveTick(0.5)).toBe(0.5)
    expect(resolveTick(100)).toBe(100)
  })
  it('"auto" resolves to 0 (native passthrough, no bucketing)', () => {
    expect(resolveTick('auto')).toBe(0)
  })
})

describe('bucketLevels', () => {
  it('groups bids into tick buckets and sums sizes (rounding down per bid)', () => {
    const raw = [
      { price: 50.01, size: 1 },
      { price: 50.07, size: 2 },
      { price: 49.99, size: 5 },
    ]
    const bucketed = bucketLevels(raw, 0.1, 'bid')
    // 50.01 and 50.07 → $50.00 bucket (size 3); 49.99 → $49.90 (size 5)
    expect(bucketed).toEqual([
      { price: 50, size: 3 },
      { price: 49.9, size: 5 },
    ])
  })

  it('groups asks into tick buckets (rounding up per ask)', () => {
    const raw = [
      { price: 50.01, size: 1 },
      { price: 50.07, size: 2 },
      { price: 50.15, size: 5 },
    ]
    const bucketed = bucketLevels(raw, 0.1, 'ask')
    // 50.01 → 50.10, 50.07 → 50.10, 50.15 → 50.20
    expect(bucketed).toEqual([
      { price: 50.1, size: 3 },
      { price: 50.2, size: 5 },
    ])
  })

  it('respects maxLevels cap', () => {
    const raw = [
      { price: 100, size: 1 },
      { price: 99, size: 1 },
      { price: 98, size: 1 },
    ]
    expect(bucketLevels(raw, 1, 'bid', 2)).toHaveLength(2)
  })

  it('tick ≤ 0 → native passthrough: sorted best-first and capped, NOT bucketed', () => {
    const raw = [
      { price: 89.135, size: 1 },
      { price: 89.163, size: 2 },
      { price: 89.15, size: 3 },
    ]
    // bids: descending; no price merged into a coarse bucket
    expect(bucketLevels(raw, 0, 'bid')).toEqual([
      { price: 89.163, size: 2 },
      { price: 89.15, size: 3 },
      { price: 89.135, size: 1 },
    ])
    // asks: ascending
    expect(bucketLevels(raw, -1, 'ask')).toEqual([
      { price: 89.135, size: 1 },
      { price: 89.15, size: 3 },
      { price: 89.163, size: 2 },
    ])
    // maxLevels still honoured on the passthrough path
    expect(bucketLevels(raw, 0, 'bid', 2)).toHaveLength(2)
  })

  it('STAB-06 regression: a tight 20-level HL-style book keeps full native depth under auto', () => {
    // Real Hyperliquid SOL book: 20 bids spanning only ~$0.028. The old auto
    // tick (0.1) floored all 20 into a single bucket → orderbook showed 1 bid.
    const bids = Array.from({ length: 20 }, (_, i) => ({
      price: 89.163 - i * 0.0015,
      size: 1,
    }))
    const out = bucketLevels(bids, inferAutoTick(), 'bid', 20)
    expect(out).toHaveLength(20)
    expect(out[0].price).toBeGreaterThan(out[19].price) // descending, distinct
  })
})

describe('tickToL2BookAggregation', () => {
  it('sub-dollar asset: nSigFigs counts from leading non-zero digit', () => {
    // WLD-like: markPrice 0.26, tick 0.00001 → sigFigs = 0 + 5 = 5.
    expect(tickToL2BookAggregation(0.00001, 0.26)).toEqual({ nSigFigs: 5 })
    expect(tickToL2BookAggregation(0.0001, 0.26)).toEqual({ nSigFigs: 4 })
    expect(tickToL2BookAggregation(0.001, 0.26)).toEqual({ nSigFigs: 3 })
    expect(tickToL2BookAggregation(0.01, 0.26)).toEqual({ nSigFigs: 2 })
  })

  it('five-figure asset: standard nSigFigs mapping', () => {
    // BTC-like: markPrice 77726, priceDigits = 5.
    expect(tickToL2BookAggregation(1, 77726)).toEqual({ nSigFigs: 5 })
    expect(tickToL2BookAggregation(10, 77726)).toEqual({ nSigFigs: 4 })
    expect(tickToL2BookAggregation(100, 77726)).toEqual({ nSigFigs: 3 })
    expect(tickToL2BookAggregation(1000, 77726)).toEqual({ nSigFigs: 2 })
  })

  it('clamps coarser-than-HL-allows to nSigFigs=2 (safety belt)', () => {
    // Coarser than ladder ever emits; protects ad-hoc callers.
    expect(tickToL2BookAggregation(10000, 77726)).toEqual({ nSigFigs: 2 })
  })

  it('returns undefined when tick is finer than HL allows', () => {
    expect(tickToL2BookAggregation(0.000001, 0.26)).toBeUndefined()
  })

  it('returns undefined for non-finite or non-positive inputs', () => {
    expect(tickToL2BookAggregation(0, 0.26)).toBeUndefined()
    expect(tickToL2BookAggregation(0.01, 0)).toBeUndefined()
    expect(tickToL2BookAggregation(0.01, Number.NaN)).toBeUndefined()
  })
})
