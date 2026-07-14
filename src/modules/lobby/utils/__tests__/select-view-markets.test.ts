import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { selectFavoriteMarkets, orderRecentMarkets } from '../select-view-markets'

function market(symbol: string): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
  }
}

const UNIVERSE = [market('A'), market('B'), market('C')]

describe('selectFavoriteMarkets', () => {
  it('keeps only the starred markets', () => {
    const result = selectFavoriteMarkets(UNIVERSE, new Set(['A', 'C']))
    expect(result.map((m) => m.symbol)).toEqual(['A', 'C'])
  })

  it('returns them in universe order, not the Set\'s insertion order', () => {
    const result = selectFavoriteMarkets(UNIVERSE, new Set(['C', 'A']))
    expect(result.map((m) => m.symbol)).toEqual(['A', 'C'])
  })

  it('drops a starred symbol the venue no longer lists', () => {
    const result = selectFavoriteMarkets(UNIVERSE, new Set(['A', 'DELISTED']))
    expect(result.map((m) => m.symbol)).toEqual(['A'])
  })

  it('is empty when nothing is starred', () => {
    expect(selectFavoriteMarkets(UNIVERSE, new Set())).toEqual([])
  })
})

describe('orderRecentMarkets', () => {
  it('returns markets in recency order, not universe order', () => {
    const result = orderRecentMarkets(UNIVERSE, ['C', 'A'])
    expect(result.map((m) => m.symbol)).toEqual(['C', 'A'])
  })

  // The read-time intersection is what lets the write path skip reconciliation.
  it('drops a visited symbol the venue no longer lists, preserving the rest', () => {
    const result = orderRecentMarkets(UNIVERSE, ['DELISTED', 'B', 'GONE', 'A'])
    expect(result.map((m) => m.symbol)).toEqual(['B', 'A'])
  })

  it('is empty when nothing has been visited', () => {
    expect(orderRecentMarkets(UNIVERSE, [])).toEqual([])
  })

  it('is empty when the universe has not loaded', () => {
    expect(orderRecentMarkets([], ['A'])).toEqual([])
  })
})
