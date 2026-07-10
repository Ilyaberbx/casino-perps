import { describe, it, expect } from 'vitest'
import { displayTicker, symbolInitials } from '../symbol-ticker'

describe('displayTicker', () => {
  it('passes a bare perp symbol through, uppercased', () => {
    expect(displayTicker('btc')).toBe('BTC')
    expect(displayTicker('BTC')).toBe('BTC')
  })

  it('strips a market-type suffix', () => {
    expect(displayTicker('BTC-PERP')).toBe('BTC')
    expect(displayTicker('ETH-SPOT')).toBe('ETH')
  })

  it('strips a spot quote', () => {
    expect(displayTicker('BTC/USDC')).toBe('BTC')
  })

  it('strips a HIP-3 dex prefix', () => {
    expect(displayTicker('xyz:AAPL')).toBe('AAPL')
  })

  it('strips both a dex prefix and a quote', () => {
    expect(displayTicker('xyz:NVDA/USDC')).toBe('NVDA')
  })
})

describe('symbolInitials', () => {
  it('returns the first three letters of the display ticker', () => {
    expect(symbolInitials('DOGE-PERP')).toBe('DOG')
    expect(symbolInitials('xyz:AAPL')).toBe('AAP')
  })

  it('returns fewer than three letters for short tickers', () => {
    expect(symbolInitials('OP')).toBe('OP')
  })
})
