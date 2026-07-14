import { describe, it, expect } from 'vitest'
import type { Candle, PerpPositionSnapshot } from '../../../../shared/domain'
import { buildPositionPriceLines, reconcileCandles } from '../chart.utils'

function candle(openTime: number, close = 100): Candle {
  return {
    symbol: 'BTC-PERP',
    interval: '1m',
    openTime,
    open: 100,
    high: 101,
    low: 99,
    close,
    volume: 1,
  }
}

describe('reconcileCandles', () => {
  it('appends a newer candle', () => {
    const result = reconcileCandles([candle(1000)], candle(2000))
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.history.map((c) => c.openTime)).toEqual([1000, 2000])
    }
  })

  it('replaces the last candle when openTime matches (same bar)', () => {
    const result = reconcileCandles([candle(1000), candle(2000, 100)], candle(2000, 150))
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.history).toHaveLength(2)
      expect(result.history[1].close).toBe(150)
    }
  })

  it('drops a stale out-of-order candle (STAB-01 monotonicity)', () => {
    const result = reconcileCandles([candle(1000), candle(2000)], candle(1500))
    expect(result.accepted).toBe(false)
  })

  it('appends to an empty history', () => {
    const result = reconcileCandles([], candle(1000))
    expect(result.accepted).toBe(true)
    if (result.accepted) expect(result.history).toHaveLength(1)
  })
})

describe('buildPositionPriceLines', () => {
  const COLORS = {
    background: '#000',
    surface: '#111',
    border: '#222',
    borderStrong: '#333',
    gridLine: '#444',
    text: '#fff',
    textMuted: '#888',
    directionUp: '#0f0',
    directionDown: '#f00',
    fontMono: 'mono',
  }

  function makePosition(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
    return {
      symbol: 'BTC-PERP',
      side: 'long',
      size: 0.5,
      entryPrice: 68_000,
      markPrice: 70_000,
      positionValueUsd: 35_000,
      unrealizedPnlUsd: 1_000,
      roePct: 14.7,
      leverage: 10,
      leverageType: 'cross',
      liquidationPrice: 62_000,
      marginUsedUsd: 3_500,
      ...overrides,
    }
  }

  it('draws an entry line and a liquidation line for an open position', () => {
    const lines = buildPositionPriceLines(makePosition(), COLORS)
    expect(lines.map((line) => line.id)).toEqual(['entry', 'liquidation'])
    expect(lines[0]).toMatchObject({ price: 68_000, style: 'dashed' })
    expect(lines[1]).toMatchObject({ price: 62_000, color: COLORS.directionDown })
  })

  it('draws nothing when flat', () => {
    expect(buildPositionPriceLines(null, COLORS)).toEqual([])
    expect(buildPositionPriceLines(makePosition({ size: 0 }), COLORS)).toEqual([])
  })

  it('skips a liquidation line the venue does not report, rather than drawing it at 0', () => {
    const lines = buildPositionPriceLines(makePosition({ liquidationPrice: null }), COLORS)
    expect(lines.map((line) => line.id)).toEqual(['entry'])
  })

  it('takes its colours from the resolved theme, never hardcoded', () => {
    const lines = buildPositionPriceLines(makePosition(), COLORS)
    expect(lines[0].color).toBe(COLORS.textMuted)
    expect(lines[1].color).toBe(COLORS.directionDown)
  })
})
