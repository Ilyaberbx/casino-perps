import { describe, it, expect } from 'vitest'
import { compactFormatter, fixedFormatter, numberFormat } from '../intl-cache'

describe('numberFormat', () => {
  it('returns the same cached instance for identical options', () => {
    const first = numberFormat({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const second = numberFormat({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(first).toBe(second)
  })

  it('returns distinct instances for different options', () => {
    const twoDecimals = numberFormat({ maximumFractionDigits: 2 })
    const fourDecimals = numberFormat({ maximumFractionDigits: 4 })
    expect(twoDecimals).not.toBe(fourDecimals)
  })

  it('formats identically to Number.prototype.toLocaleString (the swap is output-safe)', () => {
    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
    const values = [0, 1234.5, -9.999, 1_000_000, 0.000027]
    for (const value of values) {
      expect(numberFormat(options).format(value)).toBe(value.toLocaleString('en-US', options))
    }
  })

  it('matches toLocaleString for compact notation', () => {
    const options: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 2 }
    expect(numberFormat(options).format(139_033_884)).toBe(
      (139_033_884).toLocaleString('en-US', options),
    )
  })
})

describe('fixedFormatter', () => {
  it('caches by decimal count (same instance for the same decimals)', () => {
    expect(fixedFormatter(2)).toBe(fixedFormatter(2))
    expect(fixedFormatter(3)).toBe(fixedFormatter(3))
  })

  it('returns distinct instances for different decimal counts', () => {
    expect(fixedFormatter(2)).not.toBe(fixedFormatter(3))
  })

  it('is byte-identical to the equivalent numberFormat(options) call', () => {
    const decimalsToTest = [0, 1, 2, 3, 4, 6, 8]
    const values = [0, 1234.5, -9.999, 1_000_000, 0.000027]
    for (const decimals of decimalsToTest) {
      const expectedFormatter = numberFormat({
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
      for (const value of values) {
        expect(fixedFormatter(decimals).format(value)).toBe(expectedFormatter.format(value))
      }
    }
  })
})

describe('compactFormatter', () => {
  it('returns the same singleton instance on every call', () => {
    expect(compactFormatter()).toBe(compactFormatter())
  })

  it('is byte-identical to numberFormat({ notation: compact, maximumFractionDigits: 2 })', () => {
    const options: Intl.NumberFormatOptions = { notation: 'compact', maximumFractionDigits: 2 }
    const values = [0, 1000, 12_733, 139_033_884, 416_501_192, -1_126_500]
    for (const value of values) {
      expect(compactFormatter().format(value)).toBe(numberFormat(options).format(value))
    }
  })
})
