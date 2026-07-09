import { describe, it, expect } from 'vitest'
import {
  HYPERLIQUID_BUILDER,
  HYPERLIQUID_BUILDER_ADDRESS,
  HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
  HYPERLIQUID_CLOID_PREFIX,
} from '../hyperliquid.constants'
import { formatTenthsOfBpsAsPercentString } from '../hyperliquid.utils'

describe('HYPERLIQUID_CLOID_PREFIX', () => {
  it('is lowercase hex and fits inside a 32-char cloid body', () => {
    expect(HYPERLIQUID_CLOID_PREFIX).toMatch(/^[0-9a-f]+$/)
    expect(HYPERLIQUID_CLOID_PREFIX.length).toBeLessThanOrEqual(32)
  })
})

describe('HYPERLIQUID_BUILDER', () => {
  it('uses the same builder address on mainnet and testnet', () => {
    expect(HYPERLIQUID_BUILDER.mainnet.address).toBe(
      '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7',
    )
    expect(HYPERLIQUID_BUILDER.testnet.address).toBe(
      '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7',
    )
  })

  it('exposes the address as a stable top-level constant', () => {
    expect(HYPERLIQUID_BUILDER_ADDRESS).toBe(
      '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7',
    )
  })

  it('charges 35 tenths of bps (3.5 bps) on both networks', () => {
    expect(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS).toBe(35)
    expect(HYPERLIQUID_BUILDER.mainnet.feeTenthsOfBps).toBe(35)
    expect(HYPERLIQUID_BUILDER.testnet.feeTenthsOfBps).toBe(35)
  })

  it('derives maxFeeRate as the percent string corresponding to feeTenthsOfBps', () => {
    expect(HYPERLIQUID_BUILDER.mainnet.maxFeeRate).toBe('0.035%')
    expect(HYPERLIQUID_BUILDER.testnet.maxFeeRate).toBe('0.035%')
  })

  // SSoT invariant: the constants file derives maxFeeRate inline (constants
  // files cannot import utils), so this test guards against the inline
  // arithmetic drifting from formatTenthsOfBpsAsPercentString's behaviour.
  it('inline-derived maxFeeRate matches the formatter utility', () => {
    const expected = formatTenthsOfBpsAsPercentString(
      HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS,
    )
    expect(HYPERLIQUID_BUILDER.mainnet.maxFeeRate).toBe(expected)
    expect(HYPERLIQUID_BUILDER.testnet.maxFeeRate).toBe(expected)
  })

  it('stays within the Hyperliquid perps cap of 100 tenths of bps (0.1%)', () => {
    const PERPS_CAP_TENTHS_OF_BPS = 100
    expect(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS).toBeLessThanOrEqual(
      PERPS_CAP_TENTHS_OF_BPS,
    )
  })
})
