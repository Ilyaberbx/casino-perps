import { describe, it, expect } from 'vitest'
import {
  buildTickLadder,
  decimalsForTick,
  defaultTickFromLadder,
  deriveMid,
  diffLevelSizes,
  formatPrice,
  formatSize,
  formatTotal,
  formatTick,
  resolveMidDirection,
  resolveOrderbookLayout,
  withCumulativeLevels,
} from '../orderbook.utils'
import { numberFormat } from '../../../../shared/utils/intl-cache'
import type { LevelChangeSignal } from '../orderbook.types'

describe('buildTickLadder', () => {
  it('matches HL reference ladder for sub-dollar asset (WLD-like)', () => {
    expect(buildTickLadder(0.0001, 0.26)).toEqual([
      0.00001, 0.00002, 0.00005, 0.0001, 0.001, 0.01,
    ])
  })

  it('matches HL reference ladder for five-figure asset (BTC-like)', () => {
    expect(buildTickLadder(1, 77726)).toEqual([1, 2, 5, 10, 100, 1000])
  })

  it('matches HL reference ladder for sub-cent asset (kPEPE-like)', () => {
    expect(buildTickLadder(0.000001, 0.003785)).toEqual([
      0.0000001, 0.0000002, 0.0000005, 0.000001, 0.00001, 0.0001,
    ])
  })

  it('ignores tickSize when markPrice is known (HL accepts ticks finer than reported tickSize)', () => {
    // tickSize 0.01 would block 0.00001 if we floored; HL UI doesn't, so we don't.
    expect(buildTickLadder(0.01, 0.26)).toEqual([
      0.00001, 0.00002, 0.00005, 0.0001, 0.001, 0.01,
    ])
  })

  it('falls back to legacy tickSize × {1,2,5,10,100,1000} when markPrice unknown', () => {
    expect(buildTickLadder(0.01, undefined)).toEqual([0.01, 0.02, 0.05, 0.1, 1, 10])
  })

  it('falls back when markPrice is non-finite or non-positive', () => {
    expect(buildTickLadder(0.01, 0)).toEqual([0.01, 0.02, 0.05, 0.1, 1, 10])
    expect(buildTickLadder(0.01, Number.NaN)).toEqual([0.01, 0.02, 0.05, 0.1, 1, 10])
  })

  it('strips float fuzz on every emitted tick', () => {
    const ladder = buildTickLadder(undefined, 0.26)
    for (const tick of ladder) {
      expect(tick.toString()).not.toMatch(/0{6,}\d/)
      expect(tick.toString()).not.toMatch(/9{6,}/)
    }
  })
})

describe('defaultTickFromLadder', () => {
  it('returns the 4th option for a full 6-element ladder (HL default)', () => {
    expect(defaultTickFromLadder([0.00001, 0.00002, 0.00005, 0.0001, 0.001, 0.01])).toBe(0.0001)
    expect(defaultTickFromLadder([1, 2, 5, 10, 100, 1000])).toBe(10)
  })

  it('falls back to the first option when the ladder is shorter than 4', () => {
    expect(defaultTickFromLadder([0.1, 1])).toBe(0.1)
  })
})

describe('formatTick / decimalsForTick', () => {
  it('formatTick renders natural decimals', () => {
    expect(formatTick(0.001)).toBe('0.001')
    expect(formatTick(10)).toBe('10')
    expect(formatTick(0.1)).toBe('0.1')
  })

  it('decimalsForTick derives decimals from magnitude', () => {
    expect(decimalsForTick(0.0001)).toBe(4)
    expect(decimalsForTick(0.1)).toBe(1)
    expect(decimalsForTick(10)).toBe(0)
  })
})

describe('formatSize / formatTotal compact notation', () => {
  it('collapses large sizes to compact K/M/B so they fit the narrow column', () => {
    expect(formatSize(139_033_884)).toBe('139.03M')
    expect(formatSize(12_733)).toBe('12.73K')
    expect(formatTotal(416_501_192)).toBe('416.5M')
    expect(formatTotal(1_126_500)).toBe('1.13M')
  })

  it('keeps fixed decimals for small values (below the compact threshold)', () => {
    expect(formatSize(44.666)).toBe('44.666')
    expect(formatSize(1.848)).toBe('1.848')
    expect(formatTotal(44.67)).toBe('44.67')
  })
})

// Characterization: the primitive-keyed formatters (fixedFormatter / compactFormatter)
// must produce byte-identical output to the prior `numberFormat(options)`-based path.
// Each `expected` below reconstructs the exact `numberFormat(...)` call the old
// implementation made, so any drift in locale/grouping/rounding/fraction digits fails.
describe('formatPrice / formatSize / formatTotal characterization (byte-identical to numberFormat path)', () => {
  const fixedExpected = (value: number, decimals: number): string =>
    numberFormat({ minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)

  const COMPACT_THRESHOLD = 1000
  const compactExpected = (value: number, smallDecimals: number): string => {
    const isCompact = Math.abs(value) >= COMPACT_THRESHOLD
    if (isCompact) {
      return numberFormat({ notation: 'compact', maximumFractionDigits: 2 }).format(value)
    }
    return fixedExpected(value, smallDecimals)
  }

  const priceValues = [0, 1, -1, 1234.5, -9.999, 0.000027, 1_000_000, 77_726.12345, -0.5]
  const priceDecimals = [0, 1, 2, 4, 6, 8]

  it('formatPrice matches the fixed-decimal numberFormat path across values and decimals', () => {
    for (const decimals of priceDecimals) {
      for (const value of priceValues) {
        expect(formatPrice(value, decimals)).toBe(fixedExpected(value, decimals))
      }
    }
  })

  it('formatPrice defaults to 2 decimals identically to the old default', () => {
    for (const value of priceValues) {
      expect(formatPrice(value)).toBe(fixedExpected(value, 2))
    }
  })

  const sizeValues = [
    0, 1.848, 44.666, 999.999, 1000, 12_733, 139_033_884, 416_501_192, -0.001, -12_733,
  ]

  it('formatSize matches the compact/fixed(3) numberFormat path across the threshold', () => {
    for (const value of sizeValues) {
      expect(formatSize(value)).toBe(compactExpected(value, 3))
    }
  })

  const totalValues = [
    0, 44.67, 999.99, 1000, 1_126_500, 416_501_192, 0.005, -1_126_500, -44.67,
  ]

  it('formatTotal matches the compact/fixed(2) numberFormat path across the threshold', () => {
    for (const value of totalValues) {
      expect(formatTotal(value)).toBe(compactExpected(value, 2))
    }
  })
})

describe('deriveMid', () => {
  it('averages the best bid and ask when both sides are present', () => {
    expect(deriveMid(100, 102)).toBe(101)
    expect(deriveMid(0.5, 0.6)).toBeCloseTo(0.55)
  })

  it('returns 0 when either side is missing (one-sided / empty book)', () => {
    expect(deriveMid(0, 102)).toBe(0)
    expect(deriveMid(100, 0)).toBe(0)
    expect(deriveMid(0, 0)).toBe(0)
  })
})

describe('resolveMidDirection', () => {
  it('lights up on an upward tick and down on a downward tick', () => {
    expect(resolveMidDirection(100, 101)).toBe('up')
    expect(resolveMidDirection(101, 100)).toBe('down')
  })

  it('is flat when the mid is unchanged', () => {
    expect(resolveMidDirection(100, 100)).toBe('flat')
  })

  it('is flat when either reading is absent (no misleading arrow)', () => {
    expect(resolveMidDirection(0, 101)).toBe('flat')
    expect(resolveMidDirection(101, 0)).toBe('flat')
  })
})

describe('withCumulativeLevels', () => {
  const bids = [
    { price: 100, size: 2 },
    { price: 99, size: 3 },
    { price: 98, size: 5 },
  ]

  it('computes cumulative base size, quote value and VWAP down the ladder', () => {
    const rows = withCumulativeLevels(bids, 'base')
    // level 0
    expect(rows[0].totalBase).toBe(2)
    expect(rows[0].totalQuote).toBe(200)
    expect(rows[0].avgPrice).toBe(100)
    // level 1: base 2+3=5, quote 200 + 99*3=497, vwap 497/5
    expect(rows[1].totalBase).toBe(5)
    expect(rows[1].totalQuote).toBe(497)
    expect(rows[1].avgPrice).toBeCloseTo(99.4)
    // level 2: base 10, quote 497 + 98*5=987, vwap 98.7
    expect(rows[2].totalBase).toBe(10)
    expect(rows[2].totalQuote).toBe(987)
    expect(rows[2].avgPrice).toBeCloseTo(98.7)
  })

  it('projects display size/total into base by default (raw size)', () => {
    const rows = withCumulativeLevels(bids, 'base')
    expect(rows[1].size).toBe(3)
    expect(rows[1].total).toBe(5)
  })

  it('projects display size/total into quote notional when sizeAsset is quote', () => {
    const rows = withCumulativeLevels(bids, 'quote')
    // per-level notional 99*3 = 297; cumulative quote = 497
    expect(rows[1].size).toBe(297)
    expect(rows[1].total).toBe(497)
    // tooltip figures stay base/quote regardless of the display projection
    expect(rows[1].totalBase).toBe(5)
    expect(rows[1].totalQuote).toBe(497)
  })

  it('falls back avgPrice to the level price rather than dividing by zero base', () => {
    const rows = withCumulativeLevels([{ price: 42, size: 0 }], 'base')
    expect(rows[0].avgPrice).toBe(42)
  })

  it('returns an empty array for an empty book', () => {
    expect(withCumulativeLevels([], 'base')).toEqual([])
  })
})

describe('diffLevelSizes', () => {
  const noSignals = new Map<number, LevelChangeSignal>()

  it('emits no signal on the first tick (nothing to diff against)', () => {
    const { sizes, signals } = diffLevelSizes(new Map(), noSignals, [
      { price: 100, size: 2 },
      { price: 99, size: 3 },
    ])
    expect(signals.size).toBe(0)
    expect(sizes.get(100)).toBe(2)
    expect(sizes.get(99)).toBe(3)
  })

  it('flashes up when a level grows and down when it shrinks', () => {
    const prevSizes = new Map([
      [100, 2],
      [99, 3],
    ])
    const { signals } = diffLevelSizes(prevSizes, noSignals, [
      { price: 100, size: 5 }, // grew
      { price: 99, size: 1 }, // shrank
    ])
    expect(signals.get(100)).toEqual({ seq: 1, dir: 'up' })
    expect(signals.get(99)).toEqual({ seq: 1, dir: 'down' })
  })

  it('bumps the seq on each successive change so the flash re-triggers', () => {
    const prevSizes = new Map([[100, 2]])
    const prevSignals = new Map<number, LevelChangeSignal>([[100, { seq: 3, dir: 'up' }]])
    const { signals } = diffLevelSizes(prevSizes, prevSignals, [{ price: 100, size: 9 }])
    expect(signals.get(100)).toEqual({ seq: 4, dir: 'up' })
  })

  it('preserves the prior signal (no re-flash) when the size is unchanged', () => {
    const prevSizes = new Map([[100, 2]])
    const prevSignals = new Map<number, LevelChangeSignal>([[100, { seq: 2, dir: 'down' }]])
    const { signals } = diffLevelSizes(prevSizes, prevSignals, [{ price: 100, size: 2 }])
    expect(signals.get(100)).toEqual({ seq: 2, dir: 'down' })
  })

  it('drops signals for prices that vanished, keeping the map bounded', () => {
    const prevSizes = new Map([
      [100, 2],
      [99, 3],
    ])
    const prevSignals = new Map<number, LevelChangeSignal>([
      [100, { seq: 1, dir: 'up' }],
      [99, { seq: 1, dir: 'up' }],
    ])
    const { sizes, signals } = diffLevelSizes(prevSizes, prevSignals, [{ price: 100, size: 2 }])
    expect(sizes.has(99)).toBe(false)
    expect(signals.has(99)).toBe(false)
    expect(signals.get(100)).toEqual({ seq: 1, dir: 'up' })
  })
})

describe('resolveOrderbookLayout', () => {
  it('sandwiches the spread between asks and bids in both mode', () => {
    expect(resolveOrderbookLayout('both')).toEqual({
      showAsks: true,
      showBids: true,
      spreadPosition: 'middle',
    })
  })

  it('pins the spread on top of a bids-only ladder', () => {
    expect(resolveOrderbookLayout('bids')).toEqual({
      showAsks: false,
      showBids: true,
      spreadPosition: 'top',
    })
  })

  it('pins the spread under an asks-only ladder', () => {
    expect(resolveOrderbookLayout('asks')).toEqual({
      showAsks: true,
      showBids: false,
      spreadPosition: 'bottom',
    })
  })
})
