import { describe, it, expect } from 'vitest'
import { symbolLogoCandidates } from '../symbol-logo-url'

const HL_BASE = 'https://app.hyperliquid.xyz/coins'

describe('symbolLogoCandidates', () => {
  it('leads with the Hyperliquid CDN url for a crypto perp symbol', () => {
    expect(symbolLogoCandidates('BTC')[0]).toBe(`${HL_BASE}/BTC.svg`)
  })

  it('strips a -PERP suffix before resolving', () => {
    expect(symbolLogoCandidates('ETH-PERP')[0]).toBe(`${HL_BASE}/ETH.svg`)
  })

  it('includes a TradingView fallback rung after the HL primary for mapped coins', () => {
    const candidates = symbolLogoCandidates('BTC')
    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates[1]).toContain('s3-symbol-logo.tradingview.com')
  })

  it('returns an empty ladder when nothing resolves (unmapped HIP-3 symbol)', () => {
    expect(symbolLogoCandidates('xyz:NOPE')).toEqual([])
  })
})
