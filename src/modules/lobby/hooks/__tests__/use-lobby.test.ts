import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { Market, MarketDataReader } from '@/modules/shared/domain'
import {
  makeVenue,
  makeVenueWrapper,
  makeMarketDataReader,
} from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { useLobby } from '../use-lobby'

function market(symbol: string, volume24h: number, change24hPct?: number): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
    volume24h,
    change24hPct,
  }
}

function wrapperWithMarkets(markets: Market[]) {
  const reader: MarketDataReader = {
    ...makeMarketDataReader(),
    listMarkets: () => markets,
  }
  return makeVenueWrapper(makeVenue({ marketData: reader }))
}

describe('useLobby', () => {
  it('is loading with three empty sections before any market lands', () => {
    const { result } = renderHook(() => useLobby(), { wrapper: wrapperWithMarkets([]) })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.sections.map((s) => s.id)).toEqual(['hot', 'new', 'all'])
    expect(result.current.sections.every((s) => s.markets.length === 0)).toBe(true)
  })

  it('labels the three sections Hot / New / All', () => {
    const { result } = renderHook(() => useLobby(), {
      wrapper: wrapperWithMarkets([market('BTC-PERP', 100)]),
    })
    expect(result.current.sections.map((s) => s.title)).toEqual([
      'Hot Markets',
      'New Listings',
      'All Markets',
    ])
  })

  it('clears loading and ranks Hot by volume once markets are present', () => {
    const markets = [
      market('A', 10),
      market('B', 900),
      market('C', 500),
      market('D', 20),
    ]
    const { result } = renderHook(() => useLobby(), { wrapper: wrapperWithMarkets(markets) })
    expect(result.current.isLoading).toBe(false)
    const hot = result.current.sections.find((s) => s.id === 'hot')
    expect(hot?.markets.map((m) => m.symbol)).toEqual(['B', 'C', 'D', 'A'])
  })

  it('is loading (and does not throw) when no venue is mounted', () => {
    const { result } = renderHook(() => useLobby())
    expect(result.current.isLoading).toBe(true)
  })
})
