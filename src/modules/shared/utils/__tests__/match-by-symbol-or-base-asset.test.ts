import { describe, it, expect } from 'vitest'
import { matchesSymbolOrBaseAsset } from '../match-by-symbol-or-base-asset'

const item = (symbol: string, baseAsset: string) => ({ symbol, baseAsset })

describe('matchesSymbolOrBaseAsset', () => {
  it('matches on the display symbol', () => {
    expect(matchesSymbolOrBaseAsset(item('BTC-PERP', 'Bitcoin'), 'btc-perp')).toBe(true)
  })

  it('matches on the base asset', () => {
    expect(matchesSymbolOrBaseAsset(item('BTC-PERP', 'Bitcoin'), 'bitcoin')).toBe(true)
  })

  it('matches a substring of either field', () => {
    expect(matchesSymbolOrBaseAsset(item('ETH-PERP', 'Ethereum'), 'eth')).toBe(true)
    expect(matchesSymbolOrBaseAsset(item('ETH-PERP', 'Ethereum'), 'ethe')).toBe(true)
  })

  it('is case-insensitive on both fields (query passed already-lowered)', () => {
    expect(matchesSymbolOrBaseAsset(item('SOL', 'Solana'), 'sol')).toBe(true)
    expect(matchesSymbolOrBaseAsset(item('SOL', 'Solana'), 'solana')).toBe(true)
  })

  it('returns false when neither field contains the query', () => {
    expect(matchesSymbolOrBaseAsset(item('BTC-PERP', 'Bitcoin'), 'doge')).toBe(false)
  })

  it('matches everything for an empty query (substring of any string)', () => {
    expect(matchesSymbolOrBaseAsset(item('BTC-PERP', 'Bitcoin'), '')).toBe(true)
  })
})
