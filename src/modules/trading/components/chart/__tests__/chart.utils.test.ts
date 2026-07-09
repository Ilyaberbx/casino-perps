import { describe, it, expect } from 'vitest'
import type { Candle } from '../../../../shared/domain'
import { reconcileCandles } from '../chart.utils'

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
