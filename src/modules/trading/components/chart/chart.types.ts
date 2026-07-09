import type { RefCallback } from 'react'
import type { Candle, Interval } from '../../../shared/domain/domain.types'
import type { CandleError } from '../../../shared/domain'

export interface UseChartParams {
  symbol: string
  interval: Interval
  /**
   * Whether this market provides candle history (resolved `Market.hasCandles`,
   * plan 03-03). When `false`, `useChart` MUST NOT call the candles capability
   * at all (guard before any candles-cap call — D-01) and exposes `noCandles`.
   */
  hasCandles: boolean
  /**
   * Decimal places for prices on this market (HL magnitude-aware rule, see
   * `shared/utils/format-price`). Drives the candle series `priceFormat`
   * (axis + crosshair label) and re-applies on market switch.
   */
  priceDecimals: number
}

export interface CrosshairOhlc {
  open: number
  high: number
  low: number
  close: number
  volume: number
  time: number
}

export type LiveBadge = 'paused' | null

export interface UseChartReturn {
  containerRef: RefCallback<HTMLDivElement>
  loading: boolean
  error: CandleError | null
  /**
   * Terminal, non-error flag: this market structurally has no candle history
   * (`Market.hasCandles === false`). Distinct from `error` (D-01 / UI-SPEC §1):
   * the no-candle state is informational, never an alarm. Mutually exclusive
   * with the loading/error/normal paths.
   */
  noCandles: boolean
  retry: () => void
  crosshairOhlc: CrosshairOhlc | null
  /**
   * One-shot: flips true on the first rendered candle and stays true (ADR-0043).
   * Replaces the old `latestCandle` state, which re-rendered the whole chart
   * subtree on every candle tick even though the only consumer was a
   * `!== null` presence check. The live candle itself lives in `lastCandleRef`
   * and updates the canvas imperatively via `series.update()`.
   */
  hasCandleData: boolean
  liveBadge: LiveBadge
}

export interface UseChartViewReturn {
  containerRef: RefCallback<HTMLDivElement>
  loading: boolean
  /**
   * Whether any candle has rendered yet. The skeleton shows until this is true,
   * not while `loading` is set — `candles.getHistory` resolves synchronously
   * from a cache, so `loading` flips false within a microtask and never gives
   * the skeleton a visible window. Candle-presence is the real loading signal.
   */
  hasCandleData: boolean
  error: CandleError | null
  noCandles: boolean
  retry: () => void
  crosshairOhlc: CrosshairOhlc | null
  liveBadge: LiveBadge
  interval: Interval
  setInterval: (next: Interval) => void
  priceDecimals: number
}

export interface ChartHeaderProps {
  ohlc: CrosshairOhlc | null
  interval: Interval
  onIntervalChange: (next: Interval) => void
  priceDecimals: number
}

export interface ChartErrorTileProps {
  onRetry: () => void
}

export type ChartUnavailableTileProps = Record<string, never>

/**
 * Result of folding a live candle into the loaded history. `accepted: false`
 * means the candle was stale/out-of-order and must be dropped (see
 * `reconcileCandles`); otherwise `history` is the next monotonic array.
 */
export type CandleReconciliation =
  | { accepted: false }
  | { accepted: true; history: Candle[] }

export interface ChartColors {
  background: string
  surface: string
  border: string
  borderStrong: string
  gridLine: string
  text: string
  textMuted: string
  directionUp: string
  directionDown: string
  fontMono: string
}
