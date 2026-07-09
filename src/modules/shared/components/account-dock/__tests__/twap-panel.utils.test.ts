import { describe, it, expect } from 'vitest'
import {
  twapAveragePrice,
  twapTimeRemainingMs,
  twapProgressFraction,
  formatTwapTimeRemaining,
  twapHistoryStatusLabel,
} from '../twap-panel.utils'

describe('twapAveragePrice', () => {
  it('divides executed notional by executed size', () => {
    expect(twapAveragePrice(50_000, 2)).toBe(25_000)
  })

  it('returns null when nothing has executed (avoid divide-by-zero)', () => {
    expect(twapAveragePrice(0, 0)).toBeNull()
  })

  it('returns null when executed size is zero even if notional is non-zero', () => {
    expect(twapAveragePrice(100, 0)).toBeNull()
  })
})

describe('twapTimeRemainingMs', () => {
  const createdAt = 1_700_000_000_000
  const durationMinutes = 30
  const endsAt = createdAt + durationMinutes * 60_000

  it('counts down from creation across the duration window', () => {
    const now = createdAt + 10 * 60_000
    expect(twapTimeRemainingMs(createdAt, durationMinutes, now)).toBe(20 * 60_000)
  })

  it('clamps to zero once the window has elapsed (never negative)', () => {
    expect(twapTimeRemainingMs(createdAt, durationMinutes, endsAt + 5_000)).toBe(0)
  })

  it('returns the full window at creation time', () => {
    expect(twapTimeRemainingMs(createdAt, durationMinutes, createdAt)).toBe(30 * 60_000)
  })
})

describe('twapProgressFraction', () => {
  it('returns executedSize / size', () => {
    expect(twapProgressFraction(2.5, 10)).toBe(0.25)
  })

  it('returns 0 when total size is zero (avoid divide-by-zero)', () => {
    expect(twapProgressFraction(0, 0)).toBe(0)
  })

  it('clamps to 1 when executed exceeds size (over-fill safety)', () => {
    expect(twapProgressFraction(12, 10)).toBe(1)
  })

  it('clamps to 0 for a negative executed size', () => {
    expect(twapProgressFraction(-1, 10)).toBe(0)
  })

  it('returns 1 for a fully executed twap', () => {
    expect(twapProgressFraction(10, 10)).toBe(1)
  })
})

describe('formatTwapTimeRemaining', () => {
  it('formats minutes and seconds under an hour', () => {
    expect(formatTwapTimeRemaining(20 * 60_000 + 5_000)).toBe('20m 05s')
  })

  it('formats hours, minutes, seconds past an hour', () => {
    expect(formatTwapTimeRemaining((90 * 60 + 7) * 1_000)).toBe('1h 30m 07s')
  })

  it('renders Done when no time remains', () => {
    expect(formatTwapTimeRemaining(0)).toBe('Done')
  })

  it('renders Done for a negative input (defensive)', () => {
    expect(formatTwapTimeRemaining(-1)).toBe('Done')
  })
})

describe('twapHistoryStatusLabel', () => {
  it('maps known statuses to title-case labels', () => {
    expect(twapHistoryStatusLabel('finished')).toBe('Finished')
    expect(twapHistoryStatusLabel('terminated')).toBe('Terminated')
    expect(twapHistoryStatusLabel('activated')).toBe('Active')
    expect(twapHistoryStatusLabel('error')).toBe('Error')
  })
})
