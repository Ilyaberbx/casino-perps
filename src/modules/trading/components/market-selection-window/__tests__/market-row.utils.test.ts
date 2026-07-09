import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { deriveMarketRowTag } from '../market-row.utils'

function market(overrides: Partial<Market>): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    ...overrides,
  } as Market
}

describe('deriveMarketRowTag', () => {
  it('tags a perp with its max leverage and strips the -PERP suffix for display', () => {
    expect(deriveMarketRowTag(market({ marketType: 'perp', maxLeverage: 20 }))).toEqual({
      tagLabel: '20x',
      displaySymbol: 'BTC',
    })
  })

  it('falls back to PERP when a perp has no leverage and still strips the suffix', () => {
    expect(deriveMarketRowTag(market({ marketType: undefined }))).toEqual({
      tagLabel: 'PERP',
      displaySymbol: 'BTC',
    })
  })

  it('tags spot markets SPOT', () => {
    expect(deriveMarketRowTag(market({ symbol: 'PURR', marketType: 'spot' }))).toEqual({
      tagLabel: 'SPOT',
      displaySymbol: 'PURR',
    })
  })

  it('tags HIP-3 with the dex short name and shows the asset segment', () => {
    expect(deriveMarketRowTag(market({ symbol: 'xyz:DOGE', marketType: 'hip3' }))).toEqual({
      tagLabel: 'XYZ',
      displaySymbol: 'DOGE',
    })
  })
})
