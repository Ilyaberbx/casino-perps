import { describe, it, expect } from 'vitest'
import { priceDecimals, formatPrice, specFromMarket } from '../format-price'
import type { Market } from '@/modules/shared/domain'

describe('priceDecimals()', () => {
  it('keeps a high-priced, high-szDecimals asset (BTC) at zero decimals', () => {
    // BTC: stepSize 1e-5 → szDecimals 5, cap 1; 77744 has 5 integer digits → 0 sig-fig decimals
    expect(priceDecimals(77744, { szDecimals: 5, marketType: 'perp' })).toBe(0)
  })

  it('gives a mid-priced asset (NATGAS) four decimals (5 sig figs)', () => {
    expect(priceDecimals(3.1231, { szDecimals: 2, marketType: 'perp' })).toBe(4)
  })

  it('gives a sub-dollar asset (KAS) six decimals, bounded by szDecimals cap', () => {
    expect(priceDecimals(0.035531, { szDecimals: 0, marketType: 'perp' })).toBe(6)
  })

  it('renders real precision for a sub-cent asset (PUMP), not zero', () => {
    expect(priceDecimals(0.0017, { szDecimals: 0, marketType: 'perp' })).toBeGreaterThan(2)
  })

  it('uses the spot 8-decimal ceiling for spot markets', () => {
    expect(priceDecimals(0.00001234, { szDecimals: 0, marketType: 'spot' })).toBe(8)
  })

  it('falls back to a capped mid default for a missing/zero price', () => {
    expect(priceDecimals(0, { szDecimals: 0, marketType: 'perp' })).toBe(2)
    expect(priceDecimals(Number.NaN, { szDecimals: 5, marketType: 'perp' })).toBe(1)
  })
})

describe('formatPrice()', () => {
  it('groups thousands and drops decimals for an integer-magnitude price', () => {
    expect(formatPrice(77744, { szDecimals: 5, marketType: 'perp' })).toBe('77,744')
  })

  it('strips trailing zeros', () => {
    expect(formatPrice(3.123, { szDecimals: 2, marketType: 'perp' })).toBe('3.123')
  })

  it('renders sub-cent assets with real digits', () => {
    expect(formatPrice(0.035531, { szDecimals: 0, marketType: 'perp' })).toBe('0.035531')
  })
})

describe('specFromMarket()', () => {
  it('recovers szDecimals from stepSize and defaults missing marketType to perp', () => {
    const market = { stepSize: 1e-5, tickSize: 0.1 } as Market
    expect(specFromMarket(market)).toEqual({ szDecimals: 5, marketType: 'perp' })
  })

  it('passes through an explicit marketType', () => {
    const market = { stepSize: 1, tickSize: 0.01, marketType: 'spot' } as Market
    expect(specFromMarket(market)).toEqual({ szDecimals: 0, marketType: 'spot' })
  })
})
