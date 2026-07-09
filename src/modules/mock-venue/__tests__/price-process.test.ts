import { describe, it, expect } from 'vitest'
import { computePrice } from '../price-process'
import { ANCHOR_PRICES } from '../mock-venue.constants'

describe('computePrice', () => {
  it('is deterministic given identical (symbol, seed, time) tuples', () => {
    const priceA = computePrice('BTC-PERP', 42, 1000)
    const priceB = computePrice('BTC-PERP', 42, 1000)
    expect(priceA).toBe(priceB)
  })

  it('differs when seed differs', () => {
    const priceA = computePrice('BTC-PERP', 1, 1000)
    const priceB = computePrice('BTC-PERP', 2, 1000)
    expect(priceA).not.toBe(priceB)
  })

  it('differs when time differs', () => {
    const priceA = computePrice('BTC-PERP', 42, 1000)
    const priceB = computePrice('BTC-PERP', 42, 2000)
    expect(priceA).not.toBe(priceB)
  })

  it('is anchored near the known market mid price for BTC-PERP', () => {
    const anchor = ANCHOR_PRICES['BTC-PERP']
    const price = computePrice('BTC-PERP', 0, 0)
    const tolerance = anchor * 0.5
    expect(price).toBeGreaterThan(anchor - tolerance)
    expect(price).toBeLessThan(anchor + tolerance)
  })

  it('is anchored near the known market mid price for ETH-PERP', () => {
    const anchor = ANCHOR_PRICES['ETH-PERP']
    const price = computePrice('ETH-PERP', 0, 0)
    const tolerance = anchor * 0.5
    expect(price).toBeGreaterThan(anchor - tolerance)
    expect(price).toBeLessThan(anchor + tolerance)
  })

  it('is anchored near the known market mid price for SOL-PERP', () => {
    const anchor = ANCHOR_PRICES['SOL-PERP']
    const price = computePrice('SOL-PERP', 0, 0)
    const tolerance = anchor * 0.5
    expect(price).toBeGreaterThan(anchor - tolerance)
    expect(price).toBeLessThan(anchor + tolerance)
  })

  it('distribution sanity: 1000 samples mostly within 3 standard deviations', () => {
    const anchor = ANCHOR_PRICES['BTC-PERP']
    const prices = Array.from({ length: 1000 }, (_, index) =>
      computePrice('BTC-PERP', 0, index * 100),
    )
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length
    const variance =
      prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length
    const standardDeviation = Math.sqrt(variance)
    const threeStandardDeviations = 3 * standardDeviation
    const withinThreeSigmaCount = prices.filter(
      (p) =>
        p > mean - threeStandardDeviations && p < mean + threeStandardDeviations,
    ).length
    const fractionWithinThreeSigma = withinThreeSigmaCount / prices.length
    expect(fractionWithinThreeSigma).toBeGreaterThan(0.99)
    expect(mean).toBeGreaterThan(anchor * 0.5)
    expect(mean).toBeLessThan(anchor * 1.5)
  })

  it('returns a positive price', () => {
    const price = computePrice('ETH-PERP', 99, 500000)
    expect(price).toBeGreaterThan(0)
  })
})
