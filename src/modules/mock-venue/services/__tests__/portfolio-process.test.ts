import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribePortfolioSnapshot, generatePortfolioHistory } from '../portfolio-process'
import type { PortfolioSnapshot, PortfolioMetric, PortfolioWindow } from '../../../shared/domain'

const FIXED_SEED = 42
const FIXED_NOW = 1_700_000_000_000

describe('subscribePortfolioSnapshot', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits an immediate snapshot on subscribe', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    expect(snapshots.length).toBe(1)
    unsubscribe()
  })

  it('emits roughly at 1Hz cadence', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    snapshots.length = 0
    vi.advanceTimersByTime(5_000)
    expect(snapshots.length).toBeGreaterThanOrEqual(4)
    expect(snapshots.length).toBeLessThanOrEqual(6)
    unsubscribe()
  })

  it('respects a custom tick interval', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
      tickIntervalMilliseconds: 500,
    })
    snapshots.length = 0
    vi.advanceTimersByTime(2_000)
    expect(snapshots.length).toBeGreaterThanOrEqual(3)
    unsubscribe()
  })

  it('produces deterministic output for a fixed seed', () => {
    const snapshotsA: PortfolioSnapshot[] = []
    const unsubscribeA = subscribePortfolioSnapshot('all', (s) => snapshotsA.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(5_000)
    unsubscribeA()

    vi.setSystemTime(FIXED_NOW)
    const snapshotsB: PortfolioSnapshot[] = []
    const unsubscribeB = subscribePortfolioSnapshot('all', (s) => snapshotsB.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(5_000)
    unsubscribeB()

    expect(snapshotsA.map((s) => s.accountValue)).toEqual(
      snapshotsB.map((s) => s.accountValue),
    )
    expect(snapshotsA.map((s) => s.pnl)).toEqual(snapshotsB.map((s) => s.pnl))
  })

  it('produces different output for different seeds', () => {
    const snapshotsA: PortfolioSnapshot[] = []
    const unsubscribeA = subscribePortfolioSnapshot('all', (s) => snapshotsA.push(s), {
      seed: 1,
    })
    vi.advanceTimersByTime(3_000)
    unsubscribeA()

    vi.setSystemTime(FIXED_NOW)
    const snapshotsB: PortfolioSnapshot[] = []
    const unsubscribeB = subscribePortfolioSnapshot('all', (s) => snapshotsB.push(s), {
      seed: 2,
    })
    vi.advanceTimersByTime(3_000)
    unsubscribeB()

    const lastA = snapshotsA[snapshotsA.length - 1].accountValue
    const lastB = snapshotsB[snapshotsB.length - 1].accountValue
    expect(lastA).not.toBe(lastB)
  })

  it('keeps account value in a sane band around the $10,000 baseline', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(60_000)
    unsubscribe()

    for (const snapshot of snapshots) {
      expect(snapshot.accountValue).toBeGreaterThan(5_000)
      expect(snapshot.accountValue).toBeLessThan(20_000)
    }
  })

  it('drift per tick is bounded near ±0.5% of account value', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(30_000)
    unsubscribe()

    for (let index = 1; index < snapshots.length; index++) {
      const previous = snapshots[index - 1].accountValue
      const current = snapshots[index].accountValue
      const relativeChange = Math.abs(current - previous) / previous
      expect(relativeChange).toBeLessThan(0.05)
    }
  })

  it('volume is non-negative and monotonically non-decreasing within a session', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(20_000)
    unsubscribe()

    for (let index = 1; index < snapshots.length; index++) {
      expect(snapshots[index].volume['24H']).toBeGreaterThanOrEqual(
        snapshots[index - 1].volume['24H'],
      )
    }
  })

  it('synthesizes a distinct pnl/volume value per window (ADR-0039)', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(5_000)
    unsubscribe()
    const last = snapshots[snapshots.length - 1]
    // Each window renders a visibly different number so the period selector is
    // exercised in dev — AllTime accumulates more than 24H.
    expect(last.volume.AllTime).toBeGreaterThan(last.volume['24H'])
    expect(last.volume['30D']).toBeGreaterThan(last.volume['7D'])
    expect(last.pnl.AllTime).not.toBe(last.pnl['24H'])
  })

  it('stops emitting after unsubscribe', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    vi.advanceTimersByTime(2_000)
    const countBefore = snapshots.length
    unsubscribe()
    vi.advanceTimersByTime(10_000)
    expect(snapshots.length).toBe(countBefore)
  })

  it('timestamp tracks the system clock', () => {
    const snapshots: PortfolioSnapshot[] = []
    const unsubscribe = subscribePortfolioSnapshot('all', (s) => snapshots.push(s), {
      seed: FIXED_SEED,
    })
    expect(snapshots[0].timestamp).toBe(FIXED_NOW)
    vi.advanceTimersByTime(1_000)
    const lastSnapshot = snapshots[snapshots.length - 1]
    expect(lastSnapshot.timestamp).toBeGreaterThanOrEqual(FIXED_NOW + 1_000)
    unsubscribe()
  })
})

describe('generatePortfolioHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const METRICS: PortfolioMetric[] = ['accountValue', 'pnl', 'perpsPnl', 'volume']

  it('produces 288 points for 24H (5-minute buckets)', () => {
    const points = generatePortfolioHistory('accountValue', '24H', 'all', { seed: FIXED_SEED })
    expect(points.length).toBe(288)
  })

  it('produces 168 points for 7D (1-hour buckets)', () => {
    const points = generatePortfolioHistory('accountValue', '7D', 'all', { seed: FIXED_SEED })
    expect(points.length).toBe(168)
  })

  it('produces 120 points for 30D (6-hour buckets)', () => {
    const points = generatePortfolioHistory('accountValue', '30D', 'all', { seed: FIXED_SEED })
    expect(points.length).toBe(120)
  })

  it('produces deterministic output for the same seed', () => {
    const a = generatePortfolioHistory('accountValue', '24H', 'all', { seed: FIXED_SEED })
    const b = generatePortfolioHistory('accountValue', '24H', 'all', { seed: FIXED_SEED })
    expect(a.map((p) => p.value)).toEqual(b.map((p) => p.value))
    expect(a.map((p) => p.timestamp)).toEqual(b.map((p) => p.timestamp))
  })

  it('produces different output for different seeds', () => {
    const a = generatePortfolioHistory('accountValue', '24H', 'all', { seed: 1 })
    const b = generatePortfolioHistory('accountValue', '24H', 'all', { seed: 2 })
    expect(a.map((p) => p.value)).not.toEqual(b.map((p) => p.value))
  })

  it('timestamps are monotonically increasing and aligned to bucket interval', () => {
    const cases: Array<{ window: PortfolioWindow; bucketMs: number }> = [
      { window: '24H', bucketMs: 5 * 60 * 1000 },
      { window: '7D', bucketMs: 60 * 60 * 1000 },
      { window: '30D', bucketMs: 6 * 60 * 60 * 1000 },
    ]
    for (const { window, bucketMs } of cases) {
      const points = generatePortfolioHistory('accountValue', window, 'all', { seed: FIXED_SEED })
      for (let index = 1; index < points.length; index++) {
        const delta = points[index].timestamp - points[index - 1].timestamp
        expect(delta).toBe(bucketMs)
      }
    }
  })

  it('supports every metric and produces finite numbers', () => {
    for (const metric of METRICS) {
      const points = generatePortfolioHistory(metric, '24H', 'all', { seed: FIXED_SEED })
      expect(points.length).toBe(288)
      for (const point of points) {
        expect(Number.isFinite(point.value)).toBe(true)
      }
    }
  })

  it('volume is non-negative and monotonically non-decreasing', () => {
    const points = generatePortfolioHistory('volume', '7D', 'all', { seed: FIXED_SEED })
    expect(points[0].value).toBeGreaterThanOrEqual(0)
    for (let index = 1; index < points.length; index++) {
      expect(points[index].value).toBeGreaterThanOrEqual(points[index - 1].value)
    }
  })
})
