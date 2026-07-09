import { describe, it, expect } from 'vitest'
import {
  parseBaseAddress,
  validateUsdcAmount,
  validateDelegationCap,
  buildDelegationScope,
  grantedScopeOf,
  toUsdcBaseUnits,
  delegationErrorCopy,
} from '../agent-balance.utils'
import type {
  AgentWalletAddress,
  DelegationConsentErrorReason,
} from '../agent-balance.types'

const RECIPIENT = '0x5555555555555555555555555555555555555555' as AgentWalletAddress

describe('delegationErrorCopy', () => {
  it('explains the not-wired signer as coming soon (not a retryable failure)', () => {
    expect(delegationErrorCopy('signer-unavailable')).toMatch(/coming soon/i)
  })

  it('gives distinct, non-empty copy for every reason', () => {
    const reasons: readonly DelegationConsentErrorReason[] = [
      'signer-rejected',
      'signer-failed',
      'server',
      'signer-unavailable',
      'unknown',
    ]
    const copies = reasons.map(delegationErrorCopy)
    expect(copies.every((c) => c.length > 0)).toBe(true)
    expect(new Set(copies).size).toBe(reasons.length)
  })
})

const VALID_ADDRESS = '0x2222222222222222222222222222222222222222'

describe('parseBaseAddress', () => {
  it('returns the address for a valid EVM address', () => {
    expect(parseBaseAddress(VALID_ADDRESS)).toBe(VALID_ADDRESS)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(parseBaseAddress(`  ${VALID_ADDRESS}  `)).toBe(VALID_ADDRESS)
  })

  it('rejects an empty string', () => {
    expect(parseBaseAddress('')).toBeNull()
    expect(parseBaseAddress('   ')).toBeNull()
  })

  it('rejects a malformed / wrong-length / non-hex destination', () => {
    expect(parseBaseAddress('0x123')).toBeNull()
    expect(parseBaseAddress('not-an-address')).toBeNull()
    expect(parseBaseAddress('0xZZZZ222222222222222222222222222222222222')).toBeNull()
  })
})

describe('validateUsdcAmount', () => {
  it('accepts an in-range amount and returns the parsed value', () => {
    const result = validateUsdcAmount('10', 50)
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(10)
  })

  it('rejects empty input', () => {
    const result = validateUsdcAmount('', 50)
    expect(result.isValid).toBe(false)
    expect(result.reason).toBe('Enter an amount')
  })

  it('rejects a non-numeric input', () => {
    expect(validateUsdcAmount('abc', 50).isValid).toBe(false)
    expect(validateUsdcAmount('-', 50).isValid).toBe(false)
  })

  it('rejects a below-minimum amount', () => {
    const result = validateUsdcAmount('0.5', 50)
    expect(result.isValid).toBe(false)
    expect(result.reason).toContain('Minimum')
  })

  it('rejects an amount exceeding the available balance', () => {
    const result = validateUsdcAmount('60', 50)
    expect(result.isValid).toBe(false)
    expect(result.reason).toBe('Amount exceeds balance')
  })
})

describe('validateDelegationCap', () => {
  it('accepts an in-range cap and returns the parsed value', () => {
    const result = validateDelegationCap('50')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(50)
  })

  it('rejects empty input', () => {
    const result = validateDelegationCap('')
    expect(result.isValid).toBe(false)
    expect(result.reason).toBe('Enter a cap')
  })

  it('rejects a non-numeric input', () => {
    expect(validateDelegationCap('abc').isValid).toBe(false)
    expect(validateDelegationCap('-').isValid).toBe(false)
  })

  it('rejects a below-minimum cap', () => {
    const result = validateDelegationCap('0.5')
    expect(result.isValid).toBe(false)
    expect(result.reason).toContain('Minimum')
  })

  it('rejects a cap above the client maximum', () => {
    const result = validateDelegationCap('5000')
    expect(result.isValid).toBe(false)
    expect(result.reason).toContain('Maximum')
  })
})

describe('buildDelegationScope', () => {
  it('builds a USDC → recipient scope from the chosen cap + ttl', () => {
    const now = new Date('2026-06-12T00:00:00.000Z')
    const scope = buildDelegationScope(RECIPIENT, 25, 7, now)

    expect(scope.action).toBe('usdc-transfer-with-authorization')
    expect(scope.recipient).toBe(RECIPIENT)
    expect(scope.capUsd).toBe('25.00')
    // 7 days after 2026-06-12 is 2026-06-19.
    expect(scope.expiresAt).toBe('2026-06-19T00:00:00.000Z')
  })
})

describe('grantedScopeOf', () => {
  it('returns the granted scope for an active view with cap + expiry', () => {
    const scope = grantedScopeOf(
      { status: 'active', appSignerId: 'sig', capUsd: '75.00', expiresAt: '2026-08-01T00:00:00.000Z' },
      RECIPIENT,
    )
    expect(scope).toEqual({
      action: 'usdc-transfer-with-authorization',
      recipient: RECIPIENT,
      capUsd: '75.00',
      expiresAt: '2026-08-01T00:00:00.000Z',
    })
  })

  it('returns null when not active or when cap/expiry are absent', () => {
    expect(
      grantedScopeOf({ status: 'not-granted', appSignerId: null, capUsd: null, expiresAt: null }, RECIPIENT),
    ).toBeNull()
    expect(
      grantedScopeOf({ status: 'active', appSignerId: null, capUsd: null, expiresAt: null }, RECIPIENT),
    ).toBeNull()
  })
})

describe('toUsdcBaseUnits', () => {
  it('scales whole USDC to 6-decimal raw units', () => {
    expect(toUsdcBaseUnits(12.5)).toBe(12_500000n)
    expect(toUsdcBaseUnits(1)).toBe(1_000000n)
  })

  it('rounds to the smallest unit deterministically', () => {
    expect(toUsdcBaseUnits(0.0000005)).toBe(1n)
  })
})
