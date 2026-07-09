import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { pickHotMarkets } from '../hot-markets-ticker.utils'
import { MIN_MARKET_VOLUME_USD } from '../../../trading.constants'

function market(symbol: string, volume24h: number): Market {
  return {
    symbol,
    baseAsset: symbol.replace('-PERP', ''),
    quoteAsset: 'USD',
    venue: 'hl',
    tickSize: 0.01,
    stepSize: 0.001,
    marketType: 'perp',
    volume24h,
    change24hPct: 0,
  }
}

describe('pickHotMarkets', () => {
  it('returns the top markets by 24h volume, highest first', () => {
    const markets = [
      market('A-PERP', MIN_MARKET_VOLUME_USD * 2),
      market('B-PERP', MIN_MARKET_VOLUME_USD * 5),
      market('C-PERP', MIN_MARKET_VOLUME_USD * 3),
    ]
    const hot = pickHotMarkets(markets, 2)
    expect(hot.map((m) => m.symbol)).toEqual(['B-PERP', 'C-PERP'])
  })

  it('drops markets below the shared liquidity floor when some clear it', () => {
    const markets = [
      market('LIQUID-PERP', MIN_MARKET_VOLUME_USD * 2),
      market('DUST-PERP', MIN_MARKET_VOLUME_USD - 1),
    ]
    const hot = pickHotMarkets(markets, 10)
    expect(hot.map((m) => m.symbol)).toEqual(['LIQUID-PERP'])
  })

  it('falls back to top-N of all markets when none clear the floor', () => {
    const markets = [
      market('X-PERP', 100),
      market('Y-PERP', 300),
      market('Z-PERP', 200),
    ]
    const hot = pickHotMarkets(markets, 2)
    expect(hot.map((m) => m.symbol)).toEqual(['Y-PERP', 'Z-PERP'])
  })

  it('returns an empty list when there are no markets', () => {
    expect(pickHotMarkets([], 10)).toEqual([])
  })

  it('treats absent volume as zero', () => {
    const withoutVolume: Market = {
      symbol: 'NOVOL-PERP',
      baseAsset: 'NOVOL',
      quoteAsset: 'USD',
      venue: 'hl',
      tickSize: 0.01,
      stepSize: 0.001,
      marketType: 'perp',
    }
    const hot = pickHotMarkets([withoutVolume, market('TOP-PERP', 500)], 2)
    expect(hot.map((m) => m.symbol)).toEqual(['TOP-PERP', 'NOVOL-PERP'])
  })
})
