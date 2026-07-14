import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { filterByMinVolume, reconcileFavorites, recordRecentMarket } from '../trading.utils'

function buildMarket(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    venue: 'hl',
    tickSize: 0.5,
    stepSize: 0.0001,
    marketType: 'perp',
    volume24h: 1_000_000,
    ...overrides,
  }
}

describe('reconcileFavorites', () => {
  it('returns empty Set when stored symbol is absent from liveMarkets', () => {
    const result = reconcileFavorites(new Set(['BTC-PERP']), [{ symbol: 'ETH-PERP', baseAsset: 'ETH', quoteAsset: 'USD', venue: 'hl', tickSize: 0.01, stepSize: 0.001 }])
    expect(result.size).toBe(0)
  })

  it('returns Set containing stored symbol when it exists in liveMarkets', () => {
    const result = reconcileFavorites(new Set(['BTC-PERP']), [{ symbol: 'BTC-PERP', baseAsset: 'BTC', quoteAsset: 'USD', venue: 'hl', tickSize: 0.5, stepSize: 0.0001 }])
    expect(result.size).toBe(1)
    expect(result.has('BTC-PERP')).toBe(true)
  })

  it('returns empty Set when storedSymbols is empty regardless of liveMarkets', () => {
    const result = reconcileFavorites(new Set([]), [{ symbol: 'BTC-PERP', baseAsset: 'BTC', quoteAsset: 'USD', venue: 'hl', tickSize: 0.5, stepSize: 0.0001 }])
    expect(result.size).toBe(0)
  })

  it('returns empty Set when liveMarkets is empty regardless of storedSymbols', () => {
    const result = reconcileFavorites(new Set(['BTC-PERP']), [])
    expect(result.size).toBe(0)
  })

  it('does not mutate the input set', () => {
    const input = new Set(['BTC-PERP'])
    const sizeBefore = input.size
    reconcileFavorites(input, [])
    expect(input.size).toBe(sizeBefore)
  })

  it('returns only the intersection when multiple symbols stored but only one is live', () => {
    const result = reconcileFavorites(
      new Set(['BTC-PERP', 'ETH-PERP']),
      [{ symbol: 'ETH-PERP', baseAsset: 'ETH', quoteAsset: 'USD', venue: 'hl', tickSize: 0.01, stepSize: 0.001 }],
    )
    expect(result.size).toBe(1)
    expect(result.has('ETH-PERP')).toBe(true)
    expect(result.has('BTC-PERP')).toBe(false)
  })
})

describe('filterByMinVolume', () => {
  it('drops markets below the floor and keeps those at or above it', () => {
    const markets = [
      buildMarket({ symbol: 'DUST-PERP', volume24h: 1_000 }),
      buildMarket({ symbol: 'LIQ-PERP', volume24h: 750_000 }),
      buildMarket({ symbol: 'EDGE-PERP', volume24h: 500_000 }),
    ]
    expect(filterByMinVolume(markets, 500_000).map((m) => m.symbol)).toEqual([
      'LIQ-PERP',
      'EDGE-PERP',
    ])
  })

  it('treats absent volume as 0 (dropped)', () => {
    expect(filterByMinVolume([buildMarket({ volume24h: undefined })], 500_000)).toHaveLength(0)
  })

  it('keeps a spot asset that clears the floor', () => {
    expect(
      filterByMinVolume([buildMarket({ marketType: 'spot', volume24h: 600_000 })], 500_000),
    ).toHaveLength(1)
  })
})

describe('recordRecentMarket', () => {
  it('prepends a new visit', () => {
    expect(recordRecentMarket(['ETH'], 'BTC', 12)).toEqual(['BTC', 'ETH'])
  })

  it('starts the list from empty', () => {
    expect(recordRecentMarket([], 'BTC', 12)).toEqual(['BTC'])
  })

  // Re-visiting must not duplicate — it promotes.
  it('moves an already-visited market back to the front instead of duplicating it', () => {
    expect(recordRecentMarket(['ETH', 'BTC', 'SOL'], 'BTC', 12)).toEqual(['BTC', 'ETH', 'SOL'])
  })

  it('re-recording the head is a no-op in content', () => {
    expect(recordRecentMarket(['BTC', 'ETH'], 'BTC', 12)).toEqual(['BTC', 'ETH'])
  })

  it('caps the list at the limit, dropping the oldest', () => {
    expect(recordRecentMarket(['B', 'C', 'D'], 'A', 3)).toEqual(['A', 'B', 'C'])
  })

  it('does not mutate the input', () => {
    const input = ['ETH']
    recordRecentMarket(input, 'BTC', 12)
    expect(input).toEqual(['ETH'])
  })
})
