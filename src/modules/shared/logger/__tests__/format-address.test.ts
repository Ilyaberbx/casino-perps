import { describe, it, expect } from 'vitest'
import { parseWalletAddress } from '@/modules/shared/domain/wallet-address'
import { formatAddress } from '../format-address'
import type { WalletAddress } from '@/modules/shared/domain/wallet-address'

function unwrap(input: string): WalletAddress {
  const result = parseWalletAddress(input)
  if (result.isErr()) throw result.error
  return result.value
}

describe('formatAddress', () => {
  it('returns "unknown" for null', () => {
    expect(formatAddress(null)).toBe('unknown')
  })

  it('renders a canonical lower-case address as 0x…<last4>', () => {
    const address = unwrap('0xabcdef0123456789abcdef0123456789abcdef01')
    expect(formatAddress(address)).toBe('0x…ef01')
  })

  it('lower-cases mixed-case input before extracting the last 4 (matches brandSdkAddress normalisation)', () => {
    // parseWalletAddress already lower-cases, so this defensively asserts formatAddress
    // also lower-cases — keeping the contract case-insensitive at the formatter boundary.
    const mixed = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaABCD' as unknown as WalletAddress
    expect(formatAddress(mixed)).toBe('0x…abcd')
  })

  it('preserves the last 4 hex chars for a typical address', () => {
    const address = unwrap('0x0000000000000000000000000000000000001234')
    expect(formatAddress(address)).toBe('0x…1234')
  })
})
