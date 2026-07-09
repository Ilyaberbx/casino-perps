/**
 * Pure helpers for the per-market tick (price-bucket) picker on the order book.
 *
 * The picker offers the ladder `0.1 / 0.2 / 0.5 / 1 / 10 / 100`, plus `auto`.
 * `auto` resolves to a concrete tick based on the asset's mark price scale.
 *
 * Bucketing is done client-side: we subscribe to Hyperliquid's raw `l2Book`
 * (no `nSigFigs`) and group prices into bins of size `tick` ourselves. This
 * makes the UX consistent across coins regardless of HL's sig-fig semantics.
 */

export type TickChoice = 'auto' | 0.1 | 0.2 | 0.5 | 1 | 10 | 100

export interface RawLevel {
  readonly price: number
  readonly size: number
}

/**
 * Pick a sensible default tick for a market based on its mark price magnitude.
 * Larger prices get coarser ticks so the book remains readable.
 *
 * `'auto'` means: show the venue's native order-book depth — do NOT bucket.
 *
 * The previous mark-price ladder (10 / 1 / 0.5 / 0.1) was orders of magnitude
 * coarser than Hyperliquid's native price granularity: a real HL l2Book is
 * ~20 levels whose *entire* span can be a few cents (e.g. SOL: 20 levels
 * across $0.028). Any positive mark-price-derived tick floors that whole book
 * into 1–2 buckets, so the orderbook rendered only ~1 bid / 1 ask (STAB-06).
 *
 * Returning `0` selects the no-bucketing passthrough in `bucketLevels`, which
 * yields the full native depth — matching what a fresh reload shows. Explicit
 * user tick choices still bucket via `resolveTick` (unchanged). Mark price no
 * longer informs the tick — the old ladder is gone — so this takes no args.
 */
export function inferAutoTick(): number {
  return 0
}

/**
 * Resolve a user-facing tick choice into a concrete numeric tick.
 * `'auto'` → native passthrough (`0`); concrete choices pass through.
 */
export function resolveTick(choice: TickChoice): number {
  if (choice === 'auto') return inferAutoTick()
  return choice
}

/**
 * Map a (display tick, mark price) pair to HL `l2Book` server-side aggregation
 * parameters. HL's `nSigFigs` accepts {2,3,4,5} or null (native precision).
 *
 * Why this matters: HL's `l2Book` only emits ~20 levels per side natively,
 * covering a tight price range. When the user picks a tick coarser than the
 * venue's native tick (AVAX native 0.001, user picks 0.01) the 20 native
 * levels bucket into just 2–3 visible rows. Asking HL to aggregate server-side
 * with `nSigFigs` derived from the display tick returns 20 already-bucketed
 * levels at that precision — restoring readable depth.
 *
 * Math: total sig figs needed = digits-before-decimal(price) + decimals(tick).
 *   - AVAX 9.27, tick 0.01 → 1 + 2 = 3 ✓
 *   - AVAX 9.27, tick 0.10 → 1 + 1 = 2 ✓
 *   - BTC 100 000, tick 10 → 6 − 1 = 5 ✓
 *
 * Returns `undefined` (= native, no server aggregation) when the tick is at
 * or finer than the native precision (computed sig figs > 5), or when the
 * tick is 0/auto, or when the mark price is unknown (pre-refresh).
 */
export function tickToL2BookAggregation(
  tick: number,
  markPrice: number,
): { nSigFigs: 2 | 3 | 4 | 5 } | undefined {
  const isTickInvalid = tick <= 0
  const isPriceInvalid = !Number.isFinite(markPrice) || markPrice <= 0
  if (isTickInvalid || isPriceInvalid) return undefined

  // Counts significant figures from the leading non-zero digit (matches HL's
  // nSigFigs semantics). Sub-1 prices yield ≤ 0, which is correct: tick 0.00001
  // on price 0.26 → sigFigs = 0 + 5 = 5, the finest HL accepts.
  const priceDigits = Math.floor(Math.log10(markPrice)) + 1
  const tickDigitsBelowOne = -Math.floor(Math.log10(tick))
  const sigFigs = priceDigits + tickDigitsBelowOne

  const isCoarserThanHlAllows = sigFigs < 2
  const isFinerThanHlAllows = sigFigs > 5
  if (isCoarserThanHlAllows) return { nSigFigs: 2 }
  if (isFinerThanHlAllows) return undefined
  return { nSigFigs: sigFigs as 2 | 3 | 4 | 5 }
}

/**
 * Bucket raw price levels into bins of size `tick`, summing the sizes of
 * orders that fall into the same bucket. Returns sorted levels:
 *   - bids: descending price (best-bid first)
 *   - asks: ascending price (best-ask first)
 *
 * For a side, the canonical "bucket price" is the floor-or-ceil of `price/tick`
 * times `tick`:
 *   - bids round DOWN (a buy at $50.07 with tick=0.1 sits in the $50.00 bucket).
 *   - asks round UP   (a sell at $50.07 with tick=0.1 sits in the $50.10 bucket).
 *
 * This preserves the spread: the best bid ≤ best ask after bucketing.
 *
 * @param maxLevels optional cap (e.g. 20) on the returned level count.
 */
export function bucketLevels(
  levels: ReadonlyArray<RawLevel>,
  tick: number,
  side: 'bid' | 'ask',
  maxLevels?: number,
): RawLevel[] {
  const sortBySide = (a: RawLevel, b: RawLevel) =>
    side === 'bid' ? b.price - a.price : a.price - b.price

  // tick ≤ 0 → native passthrough (the `'auto'` path): no bucketing, just the
  // venue's raw levels, sorted best-first and capped. This is what restores
  // full Hyperliquid depth (STAB-06).
  if (tick <= 0) {
    const native = [...levels].sort(sortBySide)
    return maxLevels !== undefined ? native.slice(0, maxLevels) : native
  }

  const bins = new Map<number, number>()
  for (const lvl of levels) {
    const bucket =
      side === 'bid'
        ? Math.floor(lvl.price / tick) * tick
        : Math.ceil(lvl.price / tick) * tick
    const rounded = Number(bucket.toFixed(10)) // strip float fuzz
    const prior = bins.get(rounded) ?? 0
    bins.set(rounded, prior + lvl.size)
  }
  const out = Array.from(bins.entries()).map(([price, size]) => ({ price, size }))
  out.sort(sortBySide)
  return maxLevels !== undefined ? out.slice(0, maxLevels) : out
}
