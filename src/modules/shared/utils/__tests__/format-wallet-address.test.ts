import { describe, it, expect } from 'vitest'
import { formatWalletAddress } from '../format-wallet-address'

describe('formatWalletAddress()', () => {
  it('checksums an all-lowercase address and renders the collapsed shorthand', () => {
    const addr = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
    // Checksum: 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed -> head "5aAe", tail "eAed"
    expect(formatWalletAddress(addr)).toBe('0x5aAe…eAed')
  })

  it('uses U+2026 ellipsis (single char), not three dots', () => {
    const addr = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
    const out = formatWalletAddress(addr)
    expect(out).toContain('…')
    expect(out).not.toContain('...')
    // Shape: 0x + 4 hex + ellipsis + 4 hex = 11 chars total
    expect(out).toHaveLength(11)
    expect(out).toMatch(/^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/)
  })

  it('throws on invalid input (mirrors viem.getAddress)', () => {
    expect(() => formatWalletAddress('0x123')).toThrow()
    expect(() => formatWalletAddress('not-an-address')).toThrow()
  })
})
