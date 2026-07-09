import { describe, it, expect } from 'vitest'
import {
  generateSnapshot,
  generateDiff,
  ORDERBOOK_DEPTH,
} from '../orderbook-generator'

describe('generateSnapshot', () => {
  it('returns a snapshot with the correct depth on each side', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    expect(snapshot.bids).toHaveLength(ORDERBOOK_DEPTH)
    expect(snapshot.asks).toHaveLength(ORDERBOOK_DEPTH)
  })

  it('bids are sorted descending by price', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    for (let index = 1; index < snapshot.bids.length; index++) {
      expect(snapshot.bids[index - 1].price).toBeGreaterThan(
        snapshot.bids[index].price,
      )
    }
  })

  it('asks are sorted ascending by price', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    for (let index = 1; index < snapshot.asks.length; index++) {
      expect(snapshot.asks[index - 1].price).toBeLessThan(
        snapshot.asks[index].price,
      )
    }
  })

  it('best bid is below best ask (no crossed book)', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    expect(snapshot.bids[0].price).toBeLessThan(snapshot.asks[0].price)
  })

  it('sizes are all positive', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    const allPositive = [...snapshot.bids, ...snapshot.asks].every(
      (level) => level.size > 0,
    )
    expect(allPositive).toBe(true)
  })

  it('sizes decay monotonically in expectation (first level >= last level)', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    expect(snapshot.bids[0].size).toBeGreaterThanOrEqual(
      snapshot.bids[snapshot.bids.length - 1].size,
    )
    expect(snapshot.asks[0].size).toBeGreaterThanOrEqual(
      snapshot.asks[snapshot.asks.length - 1].size,
    )
  })

  it('sequence number matches the provided sequence', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 7)
    expect(snapshot.sequence).toBe(7)
  })

  it('kind is snapshot', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    expect(snapshot.kind).toBe('snapshot')
  })
})

describe('generateDiff', () => {
  it('kind is diff', () => {
    const diff = generateDiff('BTC-PERP', 42, 100, 2)
    expect(diff.kind).toBe('diff')
  })

  it('has monotonically increasing sequence after snapshot', () => {
    const snapshot = generateSnapshot('BTC-PERP', 42, 0, 1)
    const diff1 = generateDiff('BTC-PERP', 42, 100, 2)
    const diff2 = generateDiff('BTC-PERP', 42, 200, 3)
    expect(diff1.sequence).toBeGreaterThan(snapshot.sequence)
    expect(diff2.sequence).toBeGreaterThan(diff1.sequence)
  })

  it('entries with size 0 represent deletions', () => {
    const diff = generateDiff('BTC-PERP', 42, 100, 2)
    const allEntries = [...diff.bids, ...diff.asks]
    const deletionEntries = allEntries.filter((level) => level.size === 0)
    const updateEntries = allEntries.filter((level) => level.size > 0)
    expect(deletionEntries.length + updateEntries.length).toBe(allEntries.length)
  })

  it('produces some changes (non-empty diff)', () => {
    const diff = generateDiff('BTC-PERP', 42, 100, 2)
    const totalEntries = diff.bids.length + diff.asks.length
    expect(totalEntries).toBeGreaterThan(0)
  })
})
