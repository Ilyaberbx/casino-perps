import { describe, it, expect } from 'vitest'
import { buildLeverageTicks, clampLeverage, resolveMaxLeverage } from '../leverage-margin.utils'
import { FALLBACK_MAX_LEVERAGE, MIN_LEVERAGE } from '../leverage-margin.constants'

describe('resolveMaxLeverage', () => {
  it('uses the market max when present and at least the floor', () => {
    expect(resolveMaxLeverage(20)).toBe(20)
  })

  it('falls back when the market omits maxLeverage', () => {
    expect(resolveMaxLeverage(undefined)).toBe(FALLBACK_MAX_LEVERAGE)
  })

  it('falls back when the market max is below the floor', () => {
    expect(resolveMaxLeverage(0)).toBe(FALLBACK_MAX_LEVERAGE)
  })
})

describe('clampLeverage', () => {
  it('rounds to an integer within range', () => {
    expect(clampLeverage(7.4, 20)).toBe(7)
    expect(clampLeverage(7.6, 20)).toBe(8)
  })

  it('clamps below the floor up to MIN_LEVERAGE', () => {
    expect(clampLeverage(0, 20)).toBe(MIN_LEVERAGE)
    expect(clampLeverage(-5, 20)).toBe(MIN_LEVERAGE)
  })

  it('clamps above the ceiling down to maxLeverage', () => {
    expect(clampLeverage(999, 20)).toBe(20)
  })

  it('returns MIN_LEVERAGE for non-finite input', () => {
    expect(clampLeverage(Number.NaN, 20)).toBe(MIN_LEVERAGE)
  })
})

describe('buildLeverageTicks', () => {
  it('includes the notable integers below the ceiling plus the ceiling (40x market)', () => {
    expect(buildLeverageTicks(40).map((tick) => tick.value)).toEqual([1, 5, 10, 20, 40])
  })

  it('drops notches at or above the ceiling (10x market)', () => {
    expect(buildLeverageTicks(10).map((tick) => tick.value)).toEqual([1, 5, 10])
  })

  it('keeps just the endpoints on a tight ceiling (3x market)', () => {
    expect(buildLeverageTicks(3).map((tick) => tick.value)).toEqual([1, 3])
  })

  it('captions only the endpoints, leaving interior notches bare', () => {
    const ticks = buildLeverageTicks(20)
    expect(ticks[0]).toEqual({ value: 1, label: '1×' })
    expect(ticks[ticks.length - 1]).toEqual({ value: 20, label: '20×' })
    expect(ticks[1]?.label).toBeUndefined()
  })
})
