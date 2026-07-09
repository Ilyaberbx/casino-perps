import { describe, it, expect } from 'vitest'
import type { PortfolioPoint } from '../../../../shared/domain'
import {
  computePeriodDelta,
  densifyPortfolioPoints,
  formatPeriodDelta,
  formatPortfolioValue,
  formatTickLabel,
  formatTooltipTitle,
  isPortfolioChartSeriesIdle,
  isSignedMetric,
  pickXTickIndices,
  pointsTimeSpan,
  withAlpha,
} from '../portfolio-chart.utils'

const TS_2026_05_16_0436_UTC = Date.UTC(2026, 4, 16, 4, 36, 0)
const TS_2026_05_14_UTC = Date.UTC(2026, 4, 14, 0, 0, 0)
const TS_2026_05_20_UTC = Date.UTC(2026, 4, 20, 0, 0, 0)

describe('formatPortfolioValue', () => {
  it('formats account value as unsigned USD with two decimals', () => {
    expect(formatPortfolioValue('accountValue', 13.18)).toBe('$13.18')
  })

  it('formats positive PNL with a leading plus and currency', () => {
    expect(formatPortfolioValue('pnl', 0.16)).toBe('+$0.16')
  })

  it('formats negative PNL with a leading minus', () => {
    expect(formatPortfolioValue('pnl', -4.5)).toBe('-$4.50')
  })

  it('omits sign for zero on signed metrics', () => {
    expect(formatPortfolioValue('pnl', 0)).toBe('$0.00')
  })

  it('uses compact notation above the 10k threshold', () => {
    expect(formatPortfolioValue('accountValue', 12_345)).toBe('$12.35K')
    expect(formatPortfolioValue('accountValue', 4_560_000)).toBe('$4.56M')
  })

  it('respects forceSign even for account value', () => {
    expect(formatPortfolioValue('accountValue', 13.18, { forceSign: true })).toBe('+$13.18')
  })
})

describe('isSignedMetric', () => {
  it('returns true for pnl and perpsPnl, false for accountValue', () => {
    expect(isSignedMetric('pnl')).toBe(true)
    expect(isSignedMetric('perpsPnl')).toBe(true)
    expect(isSignedMetric('accountValue')).toBe(false)
  })
})

describe('formatTickLabel', () => {
  it('uses HH:mm for the 24H window', () => {
    const label = formatTickLabel('24H', TS_2026_05_16_0436_UTC)
    expect(label).toMatch(/^\d{2}:\d{2}$/)
  })

  it('uses weekday + day + month for the 7D window', () => {
    const label = formatTickLabel('7D', TS_2026_05_16_0436_UTC)
    expect(label).toMatch(/^[A-Z][a-z]{2}\. \d{2} [A-Z][a-z]{2}$/)
  })

  it('uses day + month for the 30D window', () => {
    const label = formatTickLabel('30D', TS_2026_05_16_0436_UTC)
    expect(label).toMatch(/^\d{2} [A-Z][a-z]{2}$/)
  })

  it('uses day + month for short AllTime spans (<= 31 days)', () => {
    const shortSpan = 1000 * 60 * 60 * 24 * 10
    const label = formatTickLabel('AllTime', TS_2026_05_16_0436_UTC, shortSpan)
    expect(label).toMatch(/^\d{2} [A-Z][a-z]{2}$/)
  })

  it('uses month + 2-digit year for medium AllTime spans', () => {
    const mediumSpan = 1000 * 60 * 60 * 24 * 200
    const label = formatTickLabel('AllTime', TS_2026_05_16_0436_UTC, mediumSpan)
    expect(label).toMatch(/^[A-Z][a-z]{2} '\d{2}$/)
  })

  it('uses full year for AllTime spans greater than two years', () => {
    const longSpan = 1000 * 60 * 60 * 24 * 365 * 3
    const label = formatTickLabel('AllTime', TS_2026_05_16_0436_UTC, longSpan)
    expect(label).toBe('2026')
  })
})

describe('formatTooltipTitle', () => {
  it('renders weekday, month, day, year and 12-hour time', () => {
    const title = formatTooltipTitle(TS_2026_05_16_0436_UTC)
    expect(title).toMatch(/^[A-Z][a-z]{2}\. [A-Z][a-z]{2}\. \d{2} \d{4} - \d{2}:\d{2}(AM|PM)$/)
  })
})

describe('pickXTickIndices', () => {
  it('returns empty for empty series', () => {
    expect(pickXTickIndices('7D', 0)).toEqual([])
  })

  it('returns just zero for a single-point series', () => {
    expect(pickXTickIndices('7D', 1)).toEqual([0])
  })

  it('returns 7 evenly spaced indices for 7 points on the 7D window', () => {
    expect(pickXTickIndices('7D', 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('caps the tick count to the target per window', () => {
    const indices = pickXTickIndices('24H', 48)
    expect(indices.length).toBe(6)
    expect(indices[0]).toBe(0)
    expect(indices[indices.length - 1]).toBe(47)
  })

  it('returns unique strictly increasing indices', () => {
    const indices = pickXTickIndices('30D', 30)
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })
})

describe('densifyPortfolioPoints', () => {
  it('returns the series untouched when shorter than two points', () => {
    const single: PortfolioPoint[] = [{ timestamp: TS_2026_05_14_UTC, value: 5 }]
    expect(densifyPortfolioPoints([], 160)).toEqual([])
    expect(densifyPortfolioPoints(single, 160)).toBe(single)
  })

  it('returns the series untouched when already at or above the target', () => {
    const points = makePoints([1, 2, 3, 4])
    expect(densifyPortfolioPoints(points, 4)).toBe(points)
    expect(densifyPortfolioPoints(points, 3)).toBe(points)
  })

  it('returns the series untouched when it spans no time', () => {
    const flatTime: PortfolioPoint[] = [
      { timestamp: TS_2026_05_14_UTC, value: 1 },
      { timestamp: TS_2026_05_14_UTC, value: 2 },
    ]
    expect(densifyPortfolioPoints(flatTime, 160)).toBe(flatTime)
  })

  it('resamples up to the target count with time-uniform, increasing timestamps', () => {
    const dense = densifyPortfolioPoints(makePoints([10, 20]), 160)
    expect(dense).toHaveLength(160)
    for (let i = 1; i < dense.length; i += 1) {
      expect(dense[i].timestamp).toBeGreaterThan(dense[i - 1].timestamp)
    }
  })

  it('preserves the first and last point exactly', () => {
    const raw = makePoints([10, 13, 26.75])
    const dense = densifyPortfolioPoints(raw, 160)
    expect(dense[0]).toEqual(raw[0])
    expect(dense[dense.length - 1]).toEqual(raw[raw.length - 1])
  })

  it('linearly interpolates the midpoint between two knots', () => {
    const raw: PortfolioPoint[] = [
      { timestamp: 0, value: 0 },
      { timestamp: 100, value: 100 },
    ]
    const dense = densifyPortfolioPoints(raw, 101)
    // 101 samples over [0,100] → index 50 sits at t=50, value=50.
    expect(dense[50].timestamp).toBe(50)
    expect(dense[50].value).toBeCloseTo(50)
  })
})

function makePoints(values: number[]): PortfolioPoint[] {
  return values.map((value, index) => ({ timestamp: TS_2026_05_14_UTC + index * 60_000, value }))
}

describe('computePeriodDelta', () => {
  it('returns null for fewer than two points', () => {
    expect(computePeriodDelta([])).toBe(null)
    expect(computePeriodDelta(makePoints([42]))).toBe(null)
  })

  it('computes positive delta with percent', () => {
    const delta = computePeriodDelta(makePoints([100, 110]))
    expect(delta).not.toBe(null)
    expect(delta?.abs).toBeCloseTo(10)
    expect(delta?.pct).toBeCloseTo(10)
    expect(delta?.sign).toBe('up')
  })

  it('computes negative delta with percent', () => {
    const delta = computePeriodDelta(makePoints([200, 150]))
    expect(delta?.sign).toBe('down')
    expect(delta?.abs).toBeCloseTo(-50)
    expect(delta?.pct).toBeCloseTo(-25)
  })

  it('reports flat when first equals last', () => {
    const delta = computePeriodDelta(makePoints([100, 100]))
    expect(delta?.sign).toBe('flat')
    expect(delta?.abs).toBe(0)
  })

  it('returns null percent when first value is zero', () => {
    const delta = computePeriodDelta(makePoints([0, 5]))
    expect(delta?.pct).toBe(null)
    expect(delta?.sign).toBe('up')
  })
})

describe('formatPeriodDelta', () => {
  it('renders abs and percent both signed', () => {
    const text = formatPeriodDelta('accountValue', { abs: 0.16, pct: 0.53, sign: 'up' })
    expect(text).toBe('+$0.16 (+0.53%)')
  })

  it('renders without percent when pct is null', () => {
    const text = formatPeriodDelta('accountValue', { abs: 5, pct: null, sign: 'up' })
    expect(text).toBe('+$5.00')
  })

  it('renders negative delta with leading minus on both parts', () => {
    const text = formatPeriodDelta('pnl', { abs: -2.5, pct: -10, sign: 'down' })
    expect(text).toBe('-$2.50 (-10.00%)')
  })
})

describe('isPortfolioChartSeriesIdle', () => {
  it('is idle on empty', () => {
    expect(isPortfolioChartSeriesIdle([])).toBe(true)
  })

  it('is idle when all values are zero', () => {
    expect(isPortfolioChartSeriesIdle(makePoints([0, 0, 0]))).toBe(true)
  })

  it('is not idle when at least one value is non-zero', () => {
    expect(isPortfolioChartSeriesIdle(makePoints([0, 1]))).toBe(false)
  })
})

describe('pointsTimeSpan', () => {
  it('is zero for series shorter than two points', () => {
    expect(pointsTimeSpan([])).toBe(0)
    expect(pointsTimeSpan(makePoints([1]))).toBe(0)
  })

  it('spans last minus first timestamp', () => {
    const points: PortfolioPoint[] = [
      { timestamp: TS_2026_05_14_UTC, value: 1 },
      { timestamp: TS_2026_05_20_UTC, value: 2 },
    ]
    expect(pointsTimeSpan(points)).toBe(TS_2026_05_20_UTC - TS_2026_05_14_UTC)
  })
})

describe('withAlpha', () => {
  it('returns an rgba string for #rrggbb input', () => {
    expect(withAlpha('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)')
  })

  it('expands #rgb shorthand before converting', () => {
    expect(withAlpha('#f80', 0.25)).toBe('rgba(255, 136, 0, 0.25)')
  })

  it('passes non-hex strings through unchanged', () => {
    expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgb(1, 2, 3)')
  })
})
