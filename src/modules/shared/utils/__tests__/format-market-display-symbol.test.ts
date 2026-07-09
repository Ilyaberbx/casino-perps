import { describe, it, expect } from 'vitest'
import { formatMarketDisplaySymbol } from '../format-market-display-symbol'

describe('formatMarketDisplaySymbol', () => {
  it('strips the -PERP suffix from a perp identity symbol', () => {
    expect(formatMarketDisplaySymbol('BTC-PERP')).toBe('BTC')
  })

  it('passes a spot pair through unchanged', () => {
    expect(formatMarketDisplaySymbol('HYPE/USDC')).toBe('HYPE/USDC')
  })

  it('passes a HIP-3 symbol through unchanged (dex display owned by parseHip3Symbol)', () => {
    expect(formatMarketDisplaySymbol('xyz:AAPL')).toBe('xyz:AAPL')
  })

  it('returns a bare symbol with no suffix unchanged (no-op)', () => {
    expect(formatMarketDisplaySymbol('BTC')).toBe('BTC')
  })
})
