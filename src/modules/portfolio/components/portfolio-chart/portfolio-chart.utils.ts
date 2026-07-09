import type { PortfolioPoint, PortfolioWindow } from '../../../shared/domain'
import type { ThemeVariant } from '../../../shared/providers/theme-provider'
import type { PortfolioChartMetric } from './portfolio-chart.types'

function readVar(name: string): string {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  return raw.trim()
}

export function isPortfolioChartSeriesIdle(points: PortfolioPoint[]): boolean {
  if (points.length === 0) return true
  return points.every((point) => point.value === 0)
}

export interface PortfolioChartColors {
  text: string
  textMuted: string
  border: string
  borderStrong: string
  surfaceElevated: string
  directionUp: string
  directionDown: string
  accent: string
}

// themeName is part of the public signature so callers re-trigger this
// function on theme changes; the actual values come from CSS vars resolved
// at call time.
export function resolvePortfolioChartColors(themeName: ThemeVariant): PortfolioChartColors {
  void themeName
  return {
    text: readVar('--text'),
    textMuted: readVar('--textMuted'),
    border: readVar('--border'),
    borderStrong: readVar('--border-strong'),
    surfaceElevated: readVar('--surface-elevated'),
    directionUp: readVar('--directionUp'),
    directionDown: readVar('--directionDown'),
    accent: readVar('--accent'),
  }
}

// The chart.js draw animation is a canvas animation, so the app's global CSS
// `prefers-reduced-motion` kill switch does not reach it — query the preference
// here and collapse the duration to 0 at the callsite. Impure (reads the media
// query) for the same reason `resolvePortfolioChartColors` reads CSS vars.
export function prefersReducedMotion(): boolean {
  const canQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  if (!canQuery) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim()
  const isShortHex = hex.startsWith('#') && hex.length === 4
  const isLongHex = hex.startsWith('#') && hex.length === 7
  if (!isShortHex && !isLongHex) return hex
  const full = isShortHex ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  const r = parseInt(full.slice(1, 3), 16)
  const g = parseInt(full.slice(3, 5), 16)
  const b = parseInt(full.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const COMPACT_THRESHOLD = 10_000

const SIGNED_METRICS: ReadonlySet<PortfolioChartMetric> = new Set(['pnl', 'perpsPnl'])

export function isSignedMetric(metric: PortfolioChartMetric): boolean {
  return SIGNED_METRICS.has(metric)
}

export interface FormatValueOptions {
  forceSign?: boolean
}

export function formatPortfolioValue(
  metric: PortfolioChartMetric,
  value: number,
  options: FormatValueOptions = {},
): string {
  const absValue = Math.abs(value)
  const useCompact = absValue >= COMPACT_THRESHOLD
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: useCompact ? 'compact' : 'standard',
    maximumFractionDigits: useCompact ? 2 : 2,
    minimumFractionDigits: useCompact ? 0 : 2,
  })
  const formatted = formatter.format(absValue)
  const shouldShowSign = options.forceSign || isSignedMetric(metric)
  if (!shouldShowSign) return formatted
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

const WEEKDAY_DAY_MONTH = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const HOUR_MINUTE = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
})

const MONTH_YEAR_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
})

const YEAR_ONLY = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

const TOOLTIP_DATE_PARTS = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

const TOOLTIP_TIME = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2
const THIRTY_ONE_DAYS_MS = 1000 * 60 * 60 * 24 * 31

function formatWeekdayDayMonth(date: Date): string {
  const parts = WEEKDAY_DAY_MONTH.formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  return `${weekday}. ${day} ${month}`
}

export function formatTickLabel(window: PortfolioWindow, timestamp: number, span?: number): string {
  const date = new Date(timestamp)
  if (window === '24H') return HOUR_MINUTE.format(date)
  if (window === '7D') return formatWeekdayDayMonth(date)
  if (window === '30D') return DAY_MONTH.format(date)
  const effectiveSpan = span ?? THIRTY_ONE_DAYS_MS
  const isVeryLong = effectiveSpan > TWO_YEARS_MS
  if (isVeryLong) return YEAR_ONLY.format(date)
  const isShortAllTime = effectiveSpan <= THIRTY_ONE_DAYS_MS
  if (isShortAllTime) return DAY_MONTH.format(date)
  return MONTH_YEAR_SHORT.format(date).replace(' ', " '")
}

export function formatTooltipTitle(timestamp: number): string {
  const date = new Date(timestamp)
  const parts = TOOLTIP_DATE_PARTS.formatToParts(date)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const timePart = TOOLTIP_TIME.format(date).replace(/\s+/g, '')
  return `${weekday}. ${month}. ${day} ${year} - ${timePart}`
}

const TARGET_TICK_COUNT_BY_WINDOW: Record<PortfolioWindow, number> = {
  '24H': 6,
  '7D': 7,
  '30D': 6,
  AllTime: 6,
}

function evenlySpacedIndices(target: number, length: number): number[] {
  if (length === 0) return []
  if (length === 1) return [0]
  const effective = Math.min(target, length)
  if (effective <= 1) return [0]
  const indices: number[] = []
  for (let i = 0; i < effective; i += 1) {
    const idx = Math.round((i * (length - 1)) / (effective - 1))
    if (indices[indices.length - 1] !== idx) indices.push(idx)
  }
  return indices
}

export function pickXTickIndices(window: PortfolioWindow, length: number): number[] {
  return evenlySpacedIndices(TARGET_TICK_COUNT_BY_WINDOW[window], length)
}

/**
 * Resample a sparse history series up to `target` evenly-time-spaced points via
 * linear interpolation between the original knots. First and last points are
 * preserved exactly; series already at/above `target`, or too short to span any
 * time, are returned untouched. Pure — no React, no IO.
 *
 * Why: the venue history is coarse, so a stepped/segmented render looks blocky
 * and the X axis spaces knots by index rather than by clock time. A dense,
 * time-uniform series lets the monotone line curve smoothly and the tick labels
 * land at even time intervals.
 */
export function densifyPortfolioPoints(points: PortfolioPoint[], target: number): PortfolioPoint[] {
  const isTooShortToDensify = points.length < 2
  if (isTooShortToDensify) return points
  const isAlreadyDense = points.length >= target
  if (isAlreadyDense) return points

  const first = points[0]
  const last = points[points.length - 1]
  const totalSpan = last.timestamp - first.timestamp
  const hasNoTimeSpan = totalSpan <= 0
  if (hasNoTimeSpan) return points

  const lastIndex = target - 1
  const dense: PortfolioPoint[] = []
  let knot = 0
  for (let i = 0; i < target; i += 1) {
    const sampleTime = first.timestamp + (totalSpan * i) / lastIndex
    while (knot < points.length - 2 && points[knot + 1].timestamp < sampleTime) knot += 1
    const left = points[knot]
    const right = points[knot + 1]
    const segmentSpan = right.timestamp - left.timestamp
    const ratio = segmentSpan > 0 ? (sampleTime - left.timestamp) / segmentSpan : 0
    const value = left.value + (right.value - left.value) * ratio
    dense.push({ timestamp: Math.round(sampleTime), value })
  }
  // Pin exact endpoints so rounding never drifts the first/last value (the
  // end-value pin and period delta read these).
  dense[0] = { timestamp: first.timestamp, value: first.value }
  dense[lastIndex] = { timestamp: last.timestamp, value: last.value }
  return dense
}

export interface PeriodDelta {
  abs: number
  pct: number | null
  sign: 'up' | 'down' | 'flat'
}

export function computePeriodDelta(points: PortfolioPoint[]): PeriodDelta | null {
  if (points.length < 2) return null
  const first = points[0].value
  const last = points[points.length - 1].value
  const abs = last - first
  const isFlat = abs === 0
  const sign: PeriodDelta['sign'] = isFlat ? 'flat' : abs > 0 ? 'up' : 'down'
  const canComputePct = first !== 0 && Number.isFinite(first)
  const pct = canComputePct ? (abs / Math.abs(first)) * 100 : null
  return { abs, pct, sign }
}

export function formatPeriodDelta(metric: PortfolioChartMetric, delta: PeriodDelta): string {
  const absPart = formatPortfolioValue(metric, delta.abs, { forceSign: true })
  if (delta.pct === null) return absPart
  const pctSign = delta.pct > 0 ? '+' : delta.pct < 0 ? '-' : ''
  const pctFormatted = `${pctSign}${Math.abs(delta.pct).toFixed(2)}%`
  return `${absPart} (${pctFormatted})`
}

export function pointsTimeSpan(points: PortfolioPoint[]): number {
  if (points.length < 2) return 0
  return points[points.length - 1].timestamp - points[0].timestamp
}
