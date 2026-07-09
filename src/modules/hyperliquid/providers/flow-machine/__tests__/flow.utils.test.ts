import { describe, expect, it, vi } from 'vitest'
import type { Balance } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import {
  countDecimals,
  failFlow,
  mapGatewayErrorToFlowError,
  percentOfAvailable,
  readUsdcAvailable,
  resolveSelectedToken,
  validateAmountInRange,
} from '../flow.utils'

function balance(asset: string, available: number): Balance {
  return { asset, amount: available, available, amountUsd: available, pnlPct: null, source: 'spot' }
}

describe('countDecimals', () => {
  it('counts fractional digits', () => {
    expect(countDecimals('1.250')).toBe(3)
    expect(countDecimals('5')).toBe(0)
    expect(countDecimals('0.1')).toBe(1)
  })
})

describe('readUsdcAvailable', () => {
  it('reads the USDC row available, or 0 when absent', () => {
    expect(readUsdcAvailable([balance('USDC', 42), balance('HYPE', 5)])).toBe(42)
    expect(readUsdcAvailable([balance('HYPE', 5)])).toBe(0)
    expect(readUsdcAvailable([])).toBe(0)
  })
})

describe('resolveSelectedToken', () => {
  const tokens = [{ key: 'a' }, { key: 'b' }] as const

  it('returns the exact match by key', () => {
    expect(resolveSelectedToken(tokens, 'b')).toBe(tokens[1])
  })

  it('falls back to the first when the key drifts', () => {
    expect(resolveSelectedToken(tokens, 'gone')).toBe(tokens[0])
  })

  it('returns null on an empty list', () => {
    expect(resolveSelectedToken([], 'a')).toBeNull()
  })
})

describe('percentOfAvailable', () => {
  it('floors to the token decimals', () => {
    expect(percentOfAvailable(25, 100, 6)).toBe('25')
    expect(percentOfAvailable(50, 73.5, 6)).toBe('36.75')
    expect(percentOfAvailable(25, 1, 8)).toBe('0.25')
  })

  it('returns empty when nothing is available', () => {
    expect(percentOfAvailable(50, 0, 6)).toBe('')
    expect(percentOfAvailable(50, -1, 6)).toBe('')
  })
})

describe('validateAmountInRange', () => {
  it('rejects empty / non-numeric / non-positive', () => {
    expect(validateAmountInRange('', 100, 6).isValid).toBe(false)
    expect(validateAmountInRange('abc', 100, 6).isValid).toBe(false)
    expect(validateAmountInRange('-', 100, 6).isValid).toBe(false)
    expect(validateAmountInRange('0', 100, 6).isValid).toBe(false)
    expect(validateAmountInRange('-5', 100, 6).isValid).toBe(false)
  })

  it('rejects over-precision and over-balance', () => {
    expect(validateAmountInRange('5.1234567', 100, 6).isValid).toBe(false)
    expect(validateAmountInRange('101', 100, 6).isValid).toBe(false)
  })

  it('accepts an exact-cap amount and returns the parsed value', () => {
    const r = validateAmountInRange('100', 100, 6)
    expect(r.isValid).toBe(true)
    if (r.isValid) expect(r.value).toBe(100)
  })
})

describe('mapGatewayErrorToFlowError', () => {
  it('maps the direct kinds 1:1', () => {
    expect(mapGatewayErrorToFlowError('wallet-rejected')).toBe('wallet-rejected')
    expect(mapGatewayErrorToFlowError('deposit-required')).toBe('deposit-required')
    expect(mapGatewayErrorToFlowError('rate-limited')).toBe('rate-limited')
    expect(mapGatewayErrorToFlowError('network')).toBe('network')
  })

  it('collapses the remaining kinds to unknown', () => {
    expect(mapGatewayErrorToFlowError('invalid-response')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('unknown-address')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('chain-mismatch')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('builder-not-funded')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('approval-cap-reached')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('agent-cap-reached')).toBe('unknown')
    expect(mapGatewayErrorToFlowError('name-collision')).toBe('unknown')
  })
})

describe('failFlow', () => {
  it('warns with the fields + message, then dispatches FAILED(reason)', () => {
    const warn = vi.fn()
    const log = { warn } as unknown as Logger
    const dispatch = vi.fn<(action: { type: 'FAILED'; reason: string }) => void>()

    failFlow(log, dispatch, 'network', { source: 'submit' }, 'submit failed')

    expect(warn).toHaveBeenCalledWith({ source: 'submit' }, 'submit failed')
    expect(dispatch).toHaveBeenCalledWith({ type: 'FAILED', reason: 'network' })
  })
})
