import type { OrderbookLevel } from '../../../shared/domain/domain.types'
import type { BookSide, SizeAsset } from '../book-trades-panel/book-trades-panel.types'

/**
 * A ladder level with its active-size-asset display projection and the fixed
 * base/quote cumulative figures the hover tooltip shows (VWAP, total base, total
 * quote). Pure output of `withCumulativeLevels` — no flash signal yet.
 */
export interface LevelCumulative {
  price: number
  /** Per-level size projected into the active size asset (base or quote) — display. */
  size: number
  /** Cumulative total in the active size asset (display + depth-bar scale). */
  total: number
  /** Cumulative base-asset size to this level (tooltip "Total (base)"). */
  totalBase: number
  /** Cumulative quote value to this level, Σ price·size (tooltip "Total (quote)"). */
  totalQuote: number
  /** Cumulative VWAP from the best price to this level (tooltip "Avg Price"). */
  avgPrice: number
}

/** A cumulative level with the value-change flash signal attached, ready to render. */
export interface OrderbookRow extends LevelCumulative {
  /** Flash restart counter — increments each time this level's size changes (0 = never). */
  changeSeq: number
  /** Direction of the last size change, or null before this level has ever changed. */
  changeDir: ChangeDir | null
}

/** Direction a level's size last moved between ticks; gates whether a row flashes (the tint colour itself is by side — bids green, asks red). */
export type ChangeDir = 'up' | 'down'

/** Per-price-level change signal tracked across ticks by `use-orderbook`. */
export interface LevelChangeSignal {
  /** Bumped on every size change so the flash overlay remounts and replays. */
  seq: number
  dir: ChangeDir
}

/**
 * Render-time change tracker held by `use-orderbook` (React 19 idiom — set in
 * render, never in an effect). Maps each live price to its last-seen size and
 * accumulated flash signal so a size delta between ticks re-triggers the flash.
 */
export interface ChangeTracker {
  sequence: number
  sizes: Map<number, number>
  signals: Map<number, LevelChangeSignal>
}

/** Direction the mid price last ticked, used to colour the spread-row arrow. */
export type MidDirection = 'up' | 'down' | 'flat'

/** Where the spread/mid row sits relative to the ladder(s) for the active side. */
export type SpreadPosition = 'top' | 'middle' | 'bottom'

/** Which pieces the order book renders and where the spread row goes. */
export interface OrderbookLayout {
  showAsks: boolean
  showBids: boolean
  spreadPosition: SpreadPosition
}

export interface OrderbookProps {
  /** Active price-aggregation tick. 0 means native (no bucketing). */
  tick: number
  /** Which asset the size/total columns are denominated in. */
  sizeAsset: SizeAsset
  /** Which side(s) of the book to render (nado's 3-way side picker). */
  bookSide: BookSide
  baseSymbol: string
  quoteSymbol: string
  /**
   * Levels rendered per side. Defaults to `DISPLAY_DEPTH` (25) on the tall,
   * scrollable desktop rail; narrow/mobile callers pass a smaller value for a
   * shallow book that fits a short rail.
   */
  visibleDepth?: number
  /**
   * Whether this book is the visible panel. Defaults to `true`. When `false` the
   * component renders no body (returns `null`) so its ~20-row subtree stops
   * reconciling every animation frame — but the feature hook stays mounted and
   * subscribed, so its stream keeps accumulating ticks and returning to it shows
   * live state with no skeleton flash. Threaded by `BookTradesPanel` for its
   * inactive tab; other callers (mobile) omit it and render normally.
   */
  isActive?: boolean
}

export interface OrderbookLevelProps {
  /** Raw price (used both for display and for quote-size derivation). */
  price: number
  /** Already projected into the active size asset (base or quote). */
  size: number
  /** Already projected into the active size asset. */
  total: number
  /** Max total in the active size asset (for the depth bar scale). */
  maxTotal: number
  isAsk: boolean
  /** Decimals to render the price with, derived from the active tick. */
  priceDecimals: number
  /** Cumulative VWAP to this level (tooltip). */
  avgPrice: number
  /** Cumulative base-asset size to this level (tooltip). */
  totalBase: number
  /** Cumulative quote value to this level (tooltip). */
  totalQuote: number
  /** Base-asset symbol label for the tooltip (e.g. BTC). */
  baseSymbol: string
  /** Quote-asset symbol label for the tooltip (e.g. USDT). */
  quoteSymbol: string
  /** Flash restart counter; a change remounts the overlay and replays the tint. */
  changeSeq: number
  /** Direction of the last size change (green up / red down), or null. */
  changeDir: ChangeDir | null
}

/** The three cumulative figures the level hover tooltip surfaces. */
export interface OrderbookLevelTooltipProps {
  avgPrice: number
  totalBase: number
  totalQuote: number
  baseSymbol: string
  quoteSymbol: string
  priceDecimals: number
  /** Links the tooltip to its row via `aria-describedby`. */
  id: string
  /** Viewport-space anchor rect of the hovered row; the tooltip floats to its left (portal to body, escaping the book's overflow clip). */
  anchor: OrderbookTooltipAnchor
}

/** Viewport-space position the floating tooltip anchors to (a hovered row's rect). */
export interface OrderbookTooltipAnchor {
  /** Row's left viewport edge — the tooltip's right edge sits just left of this. */
  left: number
  /** Row's vertical centre in viewport space — the tooltip centres on it. */
  top: number
}

export interface OrderbookSideProps {
  /** Render-ready levels for this side (best-first). */
  rows: ReadonlyArray<OrderbookRow>
  maxTotal: number
  isAsk: boolean
  priceDecimals: number
  baseSymbol: string
  quoteSymbol: string
  /** The `.side` (+ `.asksSide`) class combination for this side. */
  className: string
}

export interface SpreadRowProps {
  /** Mid price ((bestBid + bestAsk) / 2); 0 when a side is missing. */
  mid: number
  midDirection: MidDirection
  /** Pre-formatted spread percentage (no `%` suffix). */
  spreadPercent: string
  priceDecimals: number
}

export interface OrderbookState {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  sequence: number
  timestamp: number
  isLoading: boolean
}

export interface UseOrderbookParams {
  symbol: string
  tick: number
  sizeAsset: SizeAsset
  /** Levels rendered per side; defaults to `DISPLAY_DEPTH` when omitted. */
  visibleDepth?: number
}

export interface UseOrderbookReturn {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  sequence: number
  timestamp: number
  isLoading: boolean
  /** Bids with cumulative totals + tooltip stats + flash signals (best bid first). */
  bidsWithTotals: OrderbookRow[]
  /** Asks with cumulative totals + tooltip stats + flash signals (best ask first). */
  asksWithTotals: OrderbookRow[]
  maxBidTotal: number
  maxAskTotal: number
  spread: number
  spreadPercent: string
  /** Mid price ((bestBid + bestAsk) / 2); 0 until both sides are present. */
  mid: number
  /** Direction the mid last ticked (render-time tracker). */
  midDirection: MidDirection
  priceDecimals: number
}
