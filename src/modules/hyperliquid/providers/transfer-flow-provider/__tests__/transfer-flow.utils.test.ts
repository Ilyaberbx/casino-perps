import { describe, expect, it } from 'vitest'
import {
  mapGatewayErrorToTransferError,
  oppositeAccount,
  validateTransferAmount,
} from '../transfer-flow.utils'

describe('validateTransferAmount', () => {
  it('rejects empty input', () => {
    const r = validateTransferAmount('', 100)
    expect(r.isValid).toBe(false)
  })

  it('rejects non-numeric input', () => {
    expect(validateTransferAmount('abc', 100).isValid).toBe(false)
    expect(validateTransferAmount('-', 100).isValid).toBe(false)
  })

  it('rejects 0 and negatives', () => {
    expect(validateTransferAmount('0', 100).isValid).toBe(false)
    expect(validateTransferAmount('-5', 100).isValid).toBe(false)
  })

  it('rejects more than 6 decimal places', () => {
    expect(validateTransferAmount('1.1234567', 100).isValid).toBe(false)
    expect(validateTransferAmount('1.123456', 100).isValid).toBe(true)
  })

  it('rejects an amount above available', () => {
    expect(validateTransferAmount('101', 100).isValid).toBe(false)
  })

  it('accepts an exact-balance amount and returns the parsed value', () => {
    const r = validateTransferAmount('100', 100)
    expect(r.isValid).toBe(true)
    if (r.isValid) expect(r.value).toBe(100)
  })
})

describe('oppositeAccount', () => {
  it('flips spot ↔ perps', () => {
    expect(oppositeAccount('spot')).toBe('perps')
    expect(oppositeAccount('perps')).toBe('spot')
  })
})

describe('mapGatewayErrorToTransferError', () => {
  it('maps the direct kinds 1:1', () => {
    expect(mapGatewayErrorToTransferError('wallet-rejected')).toBe('wallet-rejected')
    expect(mapGatewayErrorToTransferError('deposit-required')).toBe('deposit-required')
    expect(mapGatewayErrorToTransferError('rate-limited')).toBe('rate-limited')
    expect(mapGatewayErrorToTransferError('network')).toBe('network')
  })

  it('collapses the remaining kinds to unknown', () => {
    expect(mapGatewayErrorToTransferError('invalid-response')).toBe('unknown')
    expect(mapGatewayErrorToTransferError('unknown-address')).toBe('unknown')
    expect(mapGatewayErrorToTransferError('chain-mismatch')).toBe('unknown')
  })
})
