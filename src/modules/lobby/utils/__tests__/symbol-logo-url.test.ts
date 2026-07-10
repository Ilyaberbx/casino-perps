import { describe, it, expect } from 'vitest'
import { symbolLogoUrl } from '../symbol-logo-url'

const HL_BASE = 'https://app.hyperliquid.xyz/coins'

describe('symbolLogoUrl', () => {
  it('resolves a crypto perp symbol to the Hyperliquid CDN url', () => {
    expect(symbolLogoUrl('BTC')).toBe(`${HL_BASE}/BTC.svg`)
  })

  it('strips a -PERP suffix before resolving', () => {
    expect(symbolLogoUrl('ETH-PERP')).toBe(`${HL_BASE}/ETH.svg`)
  })

  it('returns null when nothing resolves (unmapped HIP-3 symbol)', () => {
    expect(symbolLogoUrl('xyz:NOPE')).toBeNull()
  })
})
