import { describe, it, expect } from 'vitest'
import { formatPnlPct, pnlPctSign } from '../format-pnl'

describe('formatPnlPct', () => {
  it('prefixes a + on gains and fixes 2 decimals', () => {
    expect(formatPnlPct(31.63)).toBe('+31.63%')
    expect(formatPnlPct(0.5)).toBe('+0.50%')
  })

  it('keeps the native minus on losses', () => {
    expect(formatPnlPct(-5.2)).toBe('-5.20%')
  })

  it('renders zero without a sign', () => {
    expect(formatPnlPct(0)).toBe('0.00%')
  })

  it('renders -- for an unknown value', () => {
    expect(formatPnlPct(null)).toBe('--')
  })
})

describe('pnlPctSign', () => {
  it('classifies positive, negative, and neutral', () => {
    expect(pnlPctSign(12)).toBe('positive')
    expect(pnlPctSign(-3)).toBe('negative')
    expect(pnlPctSign(0)).toBe('neutral')
    expect(pnlPctSign(null)).toBe('neutral')
  })
})
