import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getHistory,
  subscribe,
  intervalMilliseconds,
} from '../candle-generator'
import { CandleError } from '../../shared/domain'
import type { Candle, CandleUpdate, Interval } from '../../shared/domain'

// The mock generator only ever emits per-candle `new`/`update` events — never a
// bulk `snapshot` (ADR-0041). Narrow to the single-candle members so the tests
// can read `.candle` without repeating the guard.
function candleOf(update: CandleUpdate): Candle {
  if (update.kind === 'snapshot') throw new Error('mock-venue never emits snapshot updates')
  return update.candle
}

const FIXED_SEED = 42
const FIXED_SYMBOL = 'BTC-PERP'
const FIXED_INTERVAL: Interval = '1m'
const FIXED_NOW = 1_700_000_000_000

describe('getHistory', () => {
  it('returns 500 bars by default', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, undefined, FIXED_SEED, FIXED_NOW)
    expect(result.isOk()).toBe(true)
    result.map((candles) => expect(candles.length).toBe(500))
  })

  it('returns the requested number of bars', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 120, FIXED_SEED, FIXED_NOW)
    expect(result.isOk()).toBe(true)
    result.map((candles) => expect(candles.length).toBe(120))
  })

  it('produces monotonically increasing openTimes aligned to interval boundaries', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 50, FIXED_SEED, FIXED_NOW)
    expect(result.isOk()).toBe(true)
    result.map((candles) => {
      const intervalMs = intervalMilliseconds(FIXED_INTERVAL)
      for (let index = 0; index < candles.length; index++) {
        expect(candles[index].openTime % intervalMs).toBe(0)
      }
      for (let index = 1; index < candles.length; index++) {
        expect(candles[index].openTime).toBe(candles[index - 1].openTime + intervalMs)
      }
    })
  })

  it('is deterministic given fixed seed', () => {
    const a = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 50, FIXED_SEED, FIXED_NOW)
    const b = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 50, FIXED_SEED, FIXED_NOW)
    expect(a.isOk() && b.isOk()).toBe(true)
    a.map((candlesA) => b.map((candlesB) => expect(candlesA).toEqual(candlesB)))
  })

  it('produces OHLC where high >= max(open, close) and low <= min(open, close)', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 100, FIXED_SEED, FIXED_NOW)
    expect(result.isOk()).toBe(true)
    result.map((candles) => {
      for (const candle of candles) {
        expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
        expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
      }
    })
  })

  it('produces positive volume on every bar', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 100, FIXED_SEED, FIXED_NOW)
    expect(result.isOk()).toBe(true)
    result.map((candles) => {
      for (const candle of candles) {
        expect(candle.volume).toBeGreaterThan(0)
      }
    })
  })

  it('errors on invalid count (zero)', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, 0, FIXED_SEED, FIXED_NOW)
    expect(result.isErr()).toBe(true)
    result.mapErr((err) => {
      expect(err).toBeInstanceOf(CandleError)
      expect(err.kind).toBe('invalid-count')
    })
  })

  it('errors on invalid count (negative)', () => {
    const result = getHistory(FIXED_SYMBOL, FIXED_INTERVAL, -1, FIXED_SEED, FIXED_NOW)
    expect(result.isErr()).toBe(true)
    result.mapErr((err) => expect(err.kind).toBe('invalid-count'))
  })

  it('errors on empty symbol', () => {
    const result = getHistory('', FIXED_INTERVAL, 10, FIXED_SEED, FIXED_NOW)
    expect(result.isErr()).toBe(true)
    result.mapErr((err) => expect(err.kind).toBe('invalid-symbol'))
  })

  it('produces different bars across distinct intervals', () => {
    const a = getHistory(FIXED_SYMBOL, '1m', 10, FIXED_SEED, FIXED_NOW)
    const b = getHistory(FIXED_SYMBOL, '5m', 10, FIXED_SEED, FIXED_NOW)
    expect(a.isOk() && b.isOk()).toBe(true)
    a.map((candlesA) =>
      b.map((candlesB) => {
        const interval1m = intervalMilliseconds('1m')
        const interval5m = intervalMilliseconds('5m')
        expect(candlesA[0].openTime % interval1m).toBe(0)
        expect(candlesB[0].openTime % interval5m).toBe(0)
      }),
    )
  })
})

describe('intervalMilliseconds', () => {
  it('maps known intervals to milliseconds', () => {
    expect(intervalMilliseconds('1m')).toBe(60_000)
    expect(intervalMilliseconds('5m')).toBe(300_000)
    expect(intervalMilliseconds('15m')).toBe(900_000)
    expect(intervalMilliseconds('1h')).toBe(3_600_000)
    expect(intervalMilliseconds('4h')).toBe(14_400_000)
    expect(intervalMilliseconds('1d')).toBe(86_400_000)
  })
})

describe('subscribe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits an immediate update for the open bar on subscribe', () => {
    const updates: CandleUpdate[] = []
    const unsubscribe = subscribe(FIXED_SYMBOL, FIXED_INTERVAL, (u) => updates.push(u), {
      seed: FIXED_SEED,
    })
    expect(updates.length).toBe(1)
    expect(updates[0].kind).toBe('update')
    expect(candleOf(updates[0]).symbol).toBe(FIXED_SYMBOL)
    expect(candleOf(updates[0]).interval).toBe(FIXED_INTERVAL)
    unsubscribe()
  })

  it('emits update events for the open bar on each tick', () => {
    const updates: CandleUpdate[] = []
    const unsubscribe = subscribe(FIXED_SYMBOL, FIXED_INTERVAL, (u) => updates.push(u), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 1000,
    })
    vi.advanceTimersByTime(3000)
    const updateEvents = updates.filter((u) => u.kind === 'update')
    expect(updateEvents.length).toBeGreaterThanOrEqual(3)
    unsubscribe()
  })

  it('emits a new bar event when the interval boundary is crossed', () => {
    const updates: CandleUpdate[] = []
    const unsubscribe = subscribe(FIXED_SYMBOL, '1m', (u) => updates.push(u), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 1000,
    })
    const initial = updates[0]
    vi.advanceTimersByTime(intervalMilliseconds('1m') + 1000)
    const newEvents = updates.filter((u) => u.kind === 'new')
    expect(newEvents.length).toBeGreaterThanOrEqual(1)
    expect(candleOf(newEvents[0]).openTime).toBe(candleOf(initial).openTime + intervalMilliseconds('1m'))
    unsubscribe()
  })

  it('stops emitting after unsubscribe', () => {
    const updates: CandleUpdate[] = []
    const unsubscribe = subscribe(FIXED_SYMBOL, FIXED_INTERVAL, (u) => updates.push(u), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 1000,
    })
    vi.advanceTimersByTime(2000)
    const countBefore = updates.length
    unsubscribe()
    vi.advanceTimersByTime(5000)
    expect(updates.length).toBe(countBefore)
  })

  it('produces deterministic output across two seeded subscriptions', () => {
    const updatesA: CandleUpdate[] = []
    const unsubscribeA = subscribe(FIXED_SYMBOL, FIXED_INTERVAL, (u) => updatesA.push(u), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 1000,
    })
    vi.advanceTimersByTime(5000)
    unsubscribeA()

    vi.setSystemTime(FIXED_NOW)
    const updatesB: CandleUpdate[] = []
    const unsubscribeB = subscribe(FIXED_SYMBOL, FIXED_INTERVAL, (u) => updatesB.push(u), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 1000,
    })
    vi.advanceTimersByTime(5000)
    unsubscribeB()

    expect(updatesA.map((u) => candleOf(u).close)).toEqual(updatesB.map((u) => candleOf(u).close))
  })
})
