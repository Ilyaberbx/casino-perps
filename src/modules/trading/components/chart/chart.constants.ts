import type { Interval } from '../../../shared/domain/domain.types'

// Readonly<T> rather than `as const` so the array widens to ReadonlyArray<Interval>;
// the literal-tuple form would over-narrow consumers that iterate generically.
export const TIMEFRAMES: ReadonlyArray<Interval> = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

export const DEFAULT_TIMEFRAME: Interval = '1m'

// Dropdown labels: spelled out so `1m` (minute) and `1M` (month) can't be
// confused, and the week/month additions read clearly. Keyed by Interval so a
// new interval forces a label here.
export const TIMEFRAME_LABELS: Readonly<Record<Interval, string>> = {
  '1m': '1 min',
  '5m': '5 min',
  '15m': '15 min',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '1 day',
  '1w': '1 week',
  '1M': '1 month',
}

// Section a timeframe belongs to in the dropdown — drives the grouped
// MINUTES / HOURS / DAYS headers (mirrors the reference design). Keyed by
// Interval so a new interval forces a group choice here.
export const TIMEFRAME_GROUPS: Readonly<Record<Interval, string>> = {
  '1m': 'Minutes',
  '5m': 'Minutes',
  '15m': 'Minutes',
  '1h': 'Hours',
  '4h': 'Hours',
  '1d': 'Days',
  '1w': 'Days',
  '1M': 'Days',
}
