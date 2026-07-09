import { describe, expect, it } from 'vitest'
import type { Balance } from '@/modules/shared/domain'
import {
  isValidDestination,
  mapGatewayErrorToWithdrawError,
  netReceived,
  percentOfWithdrawable,
  selectWithdrawableUsdc,
  validateWithdrawAmount,
} from '../withdraw-flow.utils'

function usdcRow(available: number, source: Balance['source']): Balance {
  return {
    asset: 'USDC',
    amount: available,
    available,
    amountUsd: available,
    pnlPct: null,
    source,
  }
}

describe('validateWithdrawAmount', () => {
  it('rejects empty input', () => {
    expect(validateWithdrawAmount('', 100).isValid).toBe(false)
  })

  it('rejects non-numeric input', () => {
    expect(validateWithdrawAmount('abc', 100).isValid).toBe(false)
    expect(validateWithdrawAmount('-', 100).isValid).toBe(false)
  })

  it('rejects 0 and negatives', () => {
    expect(validateWithdrawAmount('0', 100).isValid).toBe(false)
    expect(validateWithdrawAmount('-5', 100).isValid).toBe(false)
  })

  it('rejects an amount below the MIN_WITHDRAW_USDC (2)', () => {
    const r = validateWithdrawAmount('1', 100)
    expect(r.isValid).toBe(false)
    if (!r.isValid) expect(r.reason).toMatch(/at least/i)
  })

  it('rejects more than 6 decimal places', () => {
    expect(validateWithdrawAmount('5.1234567', 100).isValid).toBe(false)
    expect(validateWithdrawAmount('5.123456', 100).isValid).toBe(true)
  })

  it('rejects an amount above the withdrawable cap', () => {
    expect(validateWithdrawAmount('101', 100).isValid).toBe(false)
  })

  it('accepts an exact-cap amount and returns the parsed value', () => {
    const r = validateWithdrawAmount('100', 100)
    expect(r.isValid).toBe(true)
    if (r.isValid) expect(r.value).toBe(100)
  })
})

describe('isValidDestination', () => {
  it('accepts a well-formed 0x address (with surrounding whitespace)', () => {
    expect(isValidDestination('0x1111111111111111111111111111111111111111')).toBe(true)
    expect(isValidDestination('  0x1111111111111111111111111111111111111111  ')).toBe(true)
  })

  it('rejects malformed / short / non-hex addresses', () => {
    expect(isValidDestination('')).toBe(false)
    expect(isValidDestination('0x123')).toBe(false)
    expect(isValidDestination('not-an-address')).toBe(false)
    expect(isValidDestination('1111111111111111111111111111111111111111')).toBe(false)
  })
})

describe('percentOfWithdrawable', () => {
  it('computes each chip of the cap', () => {
    expect(percentOfWithdrawable(25, 100)).toBe('25')
    expect(percentOfWithdrawable(50, 100)).toBe('50')
    expect(percentOfWithdrawable(100, 73.5)).toBe('73.5')
  })

  it('floors to 6 decimals', () => {
    expect(percentOfWithdrawable(25, 1)).toBe('0.25')
  })

  it('returns empty when nothing is withdrawable', () => {
    expect(percentOfWithdrawable(50, 0)).toBe('')
  })
})

describe('netReceived', () => {
  it('subtracts the flat $1 fee', () => {
    expect(netReceived(10)).toBe(9)
  })

  it('floors at 0 below the fee', () => {
    expect(netReceived(0.5)).toBe(0)
    expect(netReceived(0)).toBe(0)
    expect(netReceived(Number.NaN)).toBe(0)
  })
})

describe('selectWithdrawableUsdc', () => {
  // A UNIFIED account: the 'perps' scope is deliberately empty; the collateral
  // lives in the 'all' scope as a `source: 'unified'` USDC row. Reading 'perps'
  // (the pre-fix behaviour) stranded the user at $0 — this is the exact bug.
  it('reads the all-scope unified USDC for a unified account (perps scope is empty)', () => {
    const perpsRows: Balance[] = []
    const allRows = [usdcRow(11.25, 'unified')]
    expect(selectWithdrawableUsdc(false, perpsRows, allRows)).toBe(11.25)
  })

  // A SEGREGATED account: withdraw3 pulls from the perp pool. Spot USDC in the
  // 'all' scope is NOT directly withdrawable (needs a Spot→Perp transfer first),
  // so the perps-scope figure must win even when spot holds funds.
  it('reads the perps-scope USDC for a segregated account', () => {
    const perpsRows = [usdcRow(5, 'perps')]
    const allRows = [usdcRow(5, 'perps'), usdcRow(99, 'spot')]
    expect(selectWithdrawableUsdc(true, perpsRows, allRows)).toBe(5)
  })

  it('is 0 for a segregated account whose funds are only on spot (must transfer first)', () => {
    const perpsRows: Balance[] = []
    const allRows = [usdcRow(11.25, 'spot')]
    expect(selectWithdrawableUsdc(true, perpsRows, allRows)).toBe(0)
  })
})

describe('mapGatewayErrorToWithdrawError', () => {
  it('maps the direct kinds 1:1', () => {
    expect(mapGatewayErrorToWithdrawError('wallet-rejected')).toBe('wallet-rejected')
    expect(mapGatewayErrorToWithdrawError('deposit-required')).toBe('deposit-required')
    expect(mapGatewayErrorToWithdrawError('rate-limited')).toBe('rate-limited')
    expect(mapGatewayErrorToWithdrawError('network')).toBe('network')
  })

  it('collapses the remaining kinds to unknown', () => {
    expect(mapGatewayErrorToWithdrawError('invalid-response')).toBe('unknown')
    expect(mapGatewayErrorToWithdrawError('chain-mismatch')).toBe('unknown')
  })
})
