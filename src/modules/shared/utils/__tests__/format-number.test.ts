import { describe, it, expect } from 'vitest'
import { formatUsd, formatTokenAmount } from '../format-number'

describe('formatUsd', () => {
  it('groups thousands and pins to 2 decimals', () => {
    expect(formatUsd(5000)).toBe('$5,000.00')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
    expect(formatUsd(0)).toBe('$0.00')
  })

  it('rounds to 2 decimals rather than truncating a long tail', () => {
    expect(formatUsd(1234.56789)).toBe('$1,234.57')
  })

  it('renders negatives with a leading minus before the dollar sign', () => {
    expect(formatUsd(-42.5)).toBe('-$42.50')
  })

  it('adds a leading + for non-negative values when signed', () => {
    expect(formatUsd(42.5, { signed: true })).toBe('+$42.50')
    expect(formatUsd(-42.5, { signed: true })).toBe('-$42.50')
    expect(formatUsd(0, { signed: true })).toBe('+$0.00')
  })
})

describe('formatTokenAmount', () => {
  it('trims trailing zeros on round numbers and groups thousands', () => {
    expect(formatTokenAmount(5000)).toBe('5,000')
    expect(formatTokenAmount(1.5)).toBe('1.5')
  })

  it('keeps precision for small dust values up to the max decimals', () => {
    expect(formatTokenAmount(0.001)).toBe('0.001')
    expect(formatTokenAmount(0.00001234)).toBe('0.000012')
  })

  it('honours a custom max-decimals cap', () => {
    expect(formatTokenAmount(1.23456789, 2)).toBe('1.23')
  })
})
