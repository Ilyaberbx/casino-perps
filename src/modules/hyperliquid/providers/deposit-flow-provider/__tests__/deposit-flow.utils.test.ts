import { describe, expect, it } from 'vitest'
import {
  hasFundingForDeposit,
  resolveBranchPhase,
  validateAmount,
} from '../deposit-flow.utils'

describe('validateAmount', () => {
  it('rejects an empty amount', () => {
    expect(validateAmount('', 100)).toEqual({
      isValid: false,
      reason: 'Enter an amount',
      value: null,
    })
  })

  it('rejects a non-numeric amount', () => {
    expect(validateAmount('abc', 100).isValid).toBe(false)
  })

  it('rejects below the 5 USDC minimum', () => {
    const result = validateAmount('4.99', 100)
    expect(result.isValid).toBe(false)
    expect(result.reason).toMatch(/Minimum/)
  })

  it('rejects above the wallet balance', () => {
    const result = validateAmount('150', 100)
    expect(result.isValid).toBe(false)
    expect(result.reason).toMatch(/exceeds/)
  })

  it('accepts an amount within [5, balance] and returns the parsed value', () => {
    expect(validateAmount('50', 100)).toEqual({ isValid: true, reason: null, value: 50 })
  })
})

describe('hasFundingForDeposit', () => {
  it('is true at exactly the minimum', () => {
    expect(hasFundingForDeposit(5)).toBe(true)
  })
  it('is false below the minimum', () => {
    expect(hasFundingForDeposit(4.99)).toBe(false)
  })
})

describe('resolveBranchPhase', () => {
  it('wrong-chain wins over everything', () => {
    expect(resolveBranchPhase(100, 0.1, 1)).toBe('wrong-chain')
  })
  it('needs-funding when under the minimum on Arbitrum', () => {
    expect(resolveBranchPhase(2, 0.1, 42161)).toBe('needs-funding')
  })
  it('no-gas when funded on Arbitrum without ETH', () => {
    expect(resolveBranchPhase(100, 0, 42161)).toBe('no-gas')
  })
  it('ready when funded, on Arbitrum, with gas', () => {
    expect(resolveBranchPhase(100, 0.1, 42161)).toBe('ready')
  })
})
