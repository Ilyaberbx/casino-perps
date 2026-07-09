import type { Candle } from '../../../shared/domain'
import type { ThemeVariant } from '../../../shared/providers/theme-provider'
import type { ChartColors, CandleReconciliation } from './chart.types'

/**
 * Folds a live candle update into the loaded history. Pure reducer extracted
 * from the chart subscribe effect so the ordering invariant is testable.
 *
 * Drops stale/out-of-order candles: the HTTP backfill replay can race the live
 * WS stream and deliver an older bar after a newer one; appending it makes the
 * history non-monotonic and lightweight-charts' ascending-order assertion trips
 * (STAB-01). `openTime` ordering — not `update.kind` — is the source of truth.
 */
export function reconcileCandles(
  history: ReadonlyArray<Candle>,
  candle: Candle,
): CandleReconciliation {
  const next = history.slice()
  const last = next[next.length - 1]
  const hasLast = last !== undefined
  const isOlderThanLast = hasLast && candle.openTime < last.openTime
  if (isOlderThanLast) return { accepted: false }
  const isSameBar = hasLast && candle.openTime === last.openTime
  if (isSameBar) {
    next[next.length - 1] = candle
  } else {
    next.push(candle)
  }
  return { accepted: true, history: next }
}

/**
 * Sorts a candle buffer ascending by `openTime` and de-duplicates bars that
 * share the same `openTime`, keeping the LATER one (last occurrence in input).
 *
 * Pure bulk-merge counterpart to `reconcileCandles` (which guards single live
 * ticks only). The pan-back / load-older path prepends a fetched page onto the
 * loaded history without re-sorting; an overlapping or out-of-order page makes
 * the buffer non-monotonic. lightweight-charts re-validates ascending-by-time
 * order on EVERY `setData` — so a theme recolor or any later `setData` on that
 * buffer trips the "data must be asc ordered by time" assertion (STAB-02).
 * Funnel every bulk buffer through this before assigning the history ref and
 * before any `setData`, so the ascending invariant holds for all callers.
 */
export function sortDedupeCandles(candles: ReadonlyArray<Candle>): Candle[] {
  const byOpenTime = new Map<number, Candle>()
  // Last write wins: a later occurrence of the same openTime overwrites the
  // earlier one, so duplicates collapse to the newest bar for that timestamp.
  for (const candle of candles) {
    byOpenTime.set(candle.openTime, candle)
  }
  const deduped = Array.from(byOpenTime.values())
  deduped.sort((a, b) => a.openTime - b.openTime)
  return deduped
}

function readVar(name: string): string {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name)
  return raw.trim()
}

// themeName is part of the public signature so callers re-trigger this
// function on theme changes; the actual values come from CSS vars resolved
// at call time.
export function resolveChartColors(themeName: ThemeVariant): ChartColors {
  void themeName
  return {
    background: readVar('--background'),
    surface: readVar('--surface'),
    border: readVar('--border'),
    borderStrong: readVar('--border-strong'),
    gridLine: readVar('--chart-grid'),
    text: readVar('--text'),
    textMuted: readVar('--textMuted'),
    directionUp: readVar('--directionUp'),
    directionDown: readVar('--directionDown'),
    fontMono: readVar('--font-mono'),
  }
}

export function formatVolume(value: number): string {
  return value.toFixed(2)
}
