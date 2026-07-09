import { describe, it, expect } from 'vitest'
import { resolveMinaraRecipient } from '../agent-balance.config'

const RECIPIENT = '0xAbC0000000000000000000000000000000000001'

describe('resolveMinaraRecipient', () => {
  it('returns the lowercased recipient when configured', () => {
    expect(resolveMinaraRecipient({ VITE_MINARA_X402_RECIPIENT: RECIPIENT })).toBe(
      RECIPIENT.toLowerCase(),
    )
  })

  it('returns null when unset', () => {
    expect(resolveMinaraRecipient({})).toBeNull()
  })

  it('returns null for a malformed address', () => {
    expect(resolveMinaraRecipient({ VITE_MINARA_X402_RECIPIENT: 'not-an-address' })).toBeNull()
  })
})
