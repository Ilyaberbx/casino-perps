import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { buildLobbySections } from '../build-lobby-sections'

function market(symbol: string, volume24h: number): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
    volume24h,
  }
}

// Native listing order (universe-append order): M0 oldest … M9 newest.
const UNIVERSE: Market[] = [
  market('M0', 50),
  market('M1', 900),
  market('M2', 10),
  market('M3', 800),
  market('M4', 20),
  market('M5', 700),
  market('M6', 30),
  market('M7', 600),
  market('M8', 40),
  market('M9', 500),
]

describe('buildLobbySections', () => {
  it('ranks Hot by 24h volume descending, capped at hotLimit', () => {
    const { hot } = buildLobbySections(UNIVERSE, 3, 3)
    expect(hot.map((m) => m.symbol)).toEqual(['M1', 'M3', 'M5'])
  })

  it('treats a missing volume as zero when ranking Hot', () => {
    const markets = [market('A', 100), { ...market('B', 0), volume24h: undefined }]
    const { hot } = buildLobbySections(markets, 1, 1)
    expect(hot[0].symbol).toBe('A')
  })

  it('fills New Listings from the tail of the native order, excluding Hot', () => {
    // Hot(3) = M1,M3,M5. Remaining native order: M0,M2,M4,M6,M7,M8,M9.
    // New(3) = the last three of that = M7,M8,M9.
    const { newListings } = buildLobbySections(UNIVERSE, 3, 3)
    expect(newListings.map((m) => m.symbol)).toEqual(['M7', 'M8', 'M9'])
  })

  it('puts everything not Hot and not New into All, in native order', () => {
    const { all } = buildLobbySections(UNIVERSE, 3, 3)
    expect(all.map((m) => m.symbol)).toEqual(['M0', 'M2', 'M4', 'M6'])
  })

  it('produces three disjoint buckets covering the whole universe', () => {
    const { hot, newListings, all } = buildLobbySections(UNIVERSE, 3, 3)
    const seen = [...hot, ...newListings, ...all].map((m) => m.symbol)
    expect(new Set(seen).size).toBe(UNIVERSE.length)
    expect(seen).toHaveLength(UNIVERSE.length)
  })

  it('does not mutate the input array', () => {
    const before = UNIVERSE.map((m) => m.symbol)
    buildLobbySections(UNIVERSE, 3, 3)
    expect(UNIVERSE.map((m) => m.symbol)).toEqual(before)
  })

  it('handles a universe smaller than the limits without overlap', () => {
    const small = [market('X', 5), market('Y', 9)]
    const { hot, newListings, all } = buildLobbySections(small, 12, 12)
    expect(hot.map((m) => m.symbol)).toEqual(['Y', 'X'])
    expect(newListings).toEqual([])
    expect(all).toEqual([])
  })
})
