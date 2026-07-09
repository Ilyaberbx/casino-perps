import type { OrderbookLevel } from '../../../shared/domain/domain.types'
import type { BookSide, SizeAsset } from '../book-trades-panel/book-trades-panel.types'
import type {
  ChangeDir,
  LevelChangeSignal,
  LevelCumulative,
  MidDirection,
  OrderbookLayout,
} from './orderbook.types'
import { compactFormatter, fixedFormatter } from '@/modules/shared/utils/intl-cache'

/** Multipliers applied to the price-anchored base to produce the 6-option ladder. */
const TICK_MULTIPLIERS: ReadonlyArray<number> = [1, 2, 5, 10, 100, 1000]

/** Fallback tickSize when the venue does not surface one on the market. */
const TICK_SIZE_FALLBACK = 0.01

/** Index of the default tick within the ladder (HL's reference UI default). */
const DEFAULT_TICK_INDEX = 3

/**
 * Build the price-aggregation ladder for the orderbook tick selector.
 *
 * Primary path (markPrice known): six ticks anchored on the asset's price
 * magnitude, exactly matching HL's reference UI:
 *
 *   base = 10^(floor(log10(markPrice)) - 4)    // = HL's nSigFigs=5 tick
 *   ladder = base × {1, 2, 5, 10, 100, 1000}
 *
 *   markPrice 0.26     → 0.00001 / 0.00002 / 0.00005 / 0.0001 / 0.001 / 0.01
 *   markPrice 77 726   → 1 / 2 / 5 / 10 / 100 / 1000
 *   markPrice 0.003785 → 0.0000001 / 0.0000002 / 0.0000005 / 0.000001 / 0.00001 / 0.0001
 *
 * Fallback (markPrice missing): legacy `tickSize × {1,2,5,10,100,1000}` so the
 * picker is populated on first paint, before market ctxs stream in.
 */
export function buildTickLadder(
  tickSize: number | undefined,
  markPrice: number | undefined,
): number[] {
  const hasMarkPrice = markPrice !== undefined && Number.isFinite(markPrice) && markPrice > 0
  if (hasMarkPrice) {
    const base = Math.pow(10, Math.floor(Math.log10(markPrice)) - 4)
    return TICK_MULTIPLIERS.map((multiplier) => stripFloatFuzz(base * multiplier))
  }

  const hasTickSize = tickSize !== undefined && tickSize > 0
  const baseTick = hasTickSize ? tickSize : TICK_SIZE_FALLBACK
  return TICK_MULTIPLIERS.map((multiplier) => stripFloatFuzz(baseTick * multiplier))
}

/**
 * Pick the default tick from a ladder. Mirrors HL's reference UI which lands
 * on `base × 10` (index 3) — the most usable default: coarse enough for depth,
 * fine enough to see price action.
 */
export function defaultTickFromLadder(ladder: ReadonlyArray<number>): number {
  return ladder[DEFAULT_TICK_INDEX] ?? ladder[0]
}

/** Render a tick value as a string with the natural number of decimals. */
export function formatTick(tick: number): string {
  if (Number.isInteger(tick)) return tick.toString()
  const decimals = Math.max(0, Math.ceil(-Math.log10(tick)))
  return tick.toFixed(decimals)
}

/**
 * Bucket raw price levels into bins of size `tick`. Bids round DOWN, asks round
 * UP so the spread is preserved. `tick <= 0` is treated as native passthrough.
 * Mirrors the venue-side helper but lives in the trading module so the port
 * does not need a tick parameter.
 */
export function bucketLevels(
  levels: ReadonlyArray<OrderbookLevel>,
  tick: number,
  side: 'bid' | 'ask',
  maxLevels: number,
): OrderbookLevel[] {
  const sortBySide = (a: OrderbookLevel, b: OrderbookLevel) =>
    side === 'bid' ? b.price - a.price : a.price - b.price

  if (tick <= 0) {
    const native = [...levels].sort(sortBySide)
    return native.slice(0, maxLevels)
  }

  const bins = new Map<number, number>()
  for (const lvl of levels) {
    const bucketPrice =
      side === 'bid'
        ? Math.floor(lvl.price / tick) * tick
        : Math.ceil(lvl.price / tick) * tick
    const rounded = stripFloatFuzz(bucketPrice)
    const prior = bins.get(rounded) ?? 0
    bins.set(rounded, prior + lvl.size)
  }
  const out = Array.from(bins.entries()).map(([price, size]) => ({ price, size }))
  out.sort(sortBySide)
  return out.slice(0, maxLevels)
}

/**
 * Project raw base-size levels (best-first) into render-ready cumulative rows.
 *
 * Each row carries three independent cumulative figures, computed once here so
 * the hook and the hover tooltip stay pure and unit-tested:
 *  - `size` / `total` — the DISPLAY projection into the active size asset. In
 *    `quote` mode per-level size is notional (`price·size`) and the running
 *    total is Σ price·size; in `base` mode both are the raw base size.
 *  - `totalBase` — cumulative base-asset size to this level (Σ size).
 *  - `totalQuote` — cumulative quote value to this level (Σ price·size).
 *  - `avgPrice` — cumulative VWAP from the best price to this level
 *    (Σ price·size / Σ size); an empty running base falls back to the level's
 *    own price so the first row never divides by zero.
 */
export function withCumulativeLevels(
  levels: ReadonlyArray<OrderbookLevel>,
  sizeAsset: SizeAsset,
): LevelCumulative[] {
  let runningBase = 0
  let runningQuote = 0
  return levels.map((level) => {
    runningBase += level.size
    runningQuote += level.price * level.size
    const isQuoteAsset = sizeAsset === 'quote'
    const projectedSize = isQuoteAsset ? level.size * level.price : level.size
    const total = isQuoteAsset ? runningQuote : runningBase
    const hasBase = runningBase > 0
    const avgPrice = hasBase ? runningQuote / runningBase : level.price
    return {
      price: level.price,
      size: projectedSize,
      total,
      totalBase: runningBase,
      totalQuote: runningQuote,
      avgPrice,
    }
  })
}

/**
 * Compute the next flash signal for a single price level given its previous
 * size, its prior signal, and its current size. A brand-new price (no previous
 * size) or an unchanged size preserves the prior signal (no re-flash); a genuine
 * size delta bumps the sequence and records the direction (green up / red down).
 */
function nextSignalForLevel(
  previousSize: number | undefined,
  priorSignal: LevelChangeSignal | undefined,
  currentSize: number,
): LevelChangeSignal | undefined {
  const isNewOrUnchanged = previousSize === undefined || previousSize === currentSize
  if (isNewOrUnchanged) return priorSignal
  const dir: ChangeDir = currentSize > previousSize ? 'up' : 'down'
  return { seq: (priorSignal?.seq ?? 0) + 1, dir }
}

/**
 * Diff the current book levels against the previous tick to detect per-price
 * size changes (#291 value-change flash). Returns the next size map (current
 * sizes, keyed by price) and the next signal map. The signal map is rebuilt from
 * only the currently-present prices, so it stays bounded as prices drift instead
 * of leaking a stale entry per vanished level. Bid and ask prices never collide
 * (bids sit below the mid, asks above), so a single combined map is unambiguous.
 */
export function diffLevelSizes(
  previousSizes: ReadonlyMap<number, number>,
  previousSignals: ReadonlyMap<number, LevelChangeSignal>,
  levels: ReadonlyArray<OrderbookLevel>,
): { sizes: Map<number, number>; signals: Map<number, LevelChangeSignal> } {
  const sizes = new Map<number, number>()
  const signals = new Map<number, LevelChangeSignal>()
  for (const level of levels) {
    sizes.set(level.price, level.size)
    const nextSignal = nextSignalForLevel(
      previousSizes.get(level.price),
      previousSignals.get(level.price),
      level.size,
    )
    if (nextSignal !== undefined) signals.set(level.price, nextSignal)
  }
  return { sizes, signals }
}

/**
 * Mid price from the best bid/ask. Returns 0 when either side is missing, so a
 * one-sided or empty book renders a `--` mid rather than a misleading half-price.
 */
export function deriveMid(bestBid: number, bestAsk: number): number {
  const hasBothSides = bestBid > 0 && bestAsk > 0
  if (!hasBothSides) return 0
  return (bestBid + bestAsk) / 2
}

/**
 * Direction the mid ticked between two readings. A missing reading on either
 * side is `flat` (no arrow colour), so the arrow only lights on a real move.
 */
export function resolveMidDirection(previousMid: number, nextMid: number): MidDirection {
  const hasBothReadings = previousMid > 0 && nextMid > 0
  if (!hasBothReadings) return 'flat'
  if (nextMid > previousMid) return 'up'
  if (nextMid < previousMid) return 'down'
  return 'flat'
}

const SPREAD_POSITION_BY_SIDE: Record<BookSide, OrderbookLayout['spreadPosition']> = {
  both: 'middle',
  bids: 'top',
  asks: 'bottom',
}

/**
 * Project the active side selection into the render layout: which ladders show
 * and where the spread/mid row sits (nado's picker — `both` sandwiches the
 * spread, `bids` pins it on top, `asks` pins it at the bottom).
 */
export function resolveOrderbookLayout(bookSide: BookSide): OrderbookLayout {
  const showAsks = bookSide !== 'bids'
  const showBids = bookSide !== 'asks'
  const spreadPosition = SPREAD_POSITION_BY_SIDE[bookSide]
  return { showAsks, showBids, spreadPosition }
}

/** Decimals derived from a tick value, e.g. 0.000001 → 6, 0.1 → 1, 10 → 0. */
export function decimalsForTick(tick: number): number {
  if (tick >= 1) return 0
  return Math.max(0, Math.ceil(-Math.log10(tick)))
}

export function formatPrice(price: number, decimals = 2): string {
  return fixedFormatter(decimals).format(price)
}

/** At/above this magnitude, size/total collapse to compact K/M/B notation. */
const COMPACT_THRESHOLD = 1000

/**
 * Format a size/total for the narrow orderbook columns. Large values (≥ 1,000)
 * collapse to compact notation (`139,033,884 → 139.03M`) so they fit their
 * column instead of overflowing into the neighbouring one; smaller values keep
 * `smallDecimals` fixed decimals for readability.
 */
function formatCompact(value: number, smallDecimals: number): string {
  if (Math.abs(value) >= COMPACT_THRESHOLD) {
    return compactFormatter().format(value)
  }
  return fixedFormatter(smallDecimals).format(value)
}

export function formatSize(size: number): string {
  return formatCompact(size, 3)
}

export function formatTotal(total: number): string {
  return formatCompact(total, 2)
}

function stripFloatFuzz(value: number): number {
  return Number(value.toFixed(12))
}
