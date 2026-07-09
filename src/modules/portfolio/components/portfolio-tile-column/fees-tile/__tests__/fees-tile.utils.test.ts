import { describe, it, expect } from 'vitest'
import { formatFeePercent } from '../fees-tile.utils'

describe('formatFeePercent (#277)', () => {
  it('trims redundant trailing zeros to significant digits', () => {
    // 4.5 bps → 0.045% (was 0.0450%)
    expect(formatFeePercent(4.5)).toBe('0.045%')
    // 1.5 bps → 0.015%
    expect(formatFeePercent(1.5)).toBe('0.015%')
    // 7 bps → 0.07% (was 0.0700%)
    expect(formatFeePercent(7)).toBe('0.07%')
    // 4 bps → 0.04% (was 0.0400%)
    expect(formatFeePercent(4)).toBe('0.04%')
  })

  it('keeps at least one decimal for round values', () => {
    // 100 bps → 1.0% (never a bare "1%")
    expect(formatFeePercent(100)).toBe('1.0%')
  })

  it('renders a literal-zero fee as 0%', () => {
    expect(formatFeePercent(0)).toBe('0%')
  })

  it('does not change meaningful precision', () => {
    expect(formatFeePercent(2.5)).toBe('0.025%')
    expect(formatFeePercent(0.5)).toBe('0.005%')
  })
})
