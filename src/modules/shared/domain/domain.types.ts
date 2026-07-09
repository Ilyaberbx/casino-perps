import type { WalletAddress } from './wallet-address'

export type VenueIdentifier = string

export type OrderIdentifier = string

export type Side = 'buy' | 'sell'

export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'rejected'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

export type MarketType = 'perp' | 'spot' | 'hip3'

export interface Market {
  symbol: string
  baseAsset: string
  quoteAsset: string
  venue: VenueIdentifier
  tickSize: number
  stepSize: number
  /** Market classification. Absent on legacy mock-venue markets; treat as 'perp' when absent. */
  marketType?: MarketType
  /**
   * The HL API coin name used for all SDK calls (orderbook, trades, candles, allMids).
   * Distinct from `symbol` (the display/identity string):
   * - Perp:   bare coin name, e.g. 'BTC'        (symbol 'BTC-PERP')
   * - Spot:   the HL universe `name`: '@N' for most, e.g. '@107' (symbol
   *           'HYPE/USDC'), but the literal pair for canonical PURR/USDC →
   *           'PURR/USDC'. Never '@'+universe.index (diverges for PURR).
   * - HIP-3:  'dex:ASSET', e.g. 'xyz:AAPL'      (symbol 'xyz:AAPL')
   * Mock-venue markets set it equal to `symbol` (their generators key off the
   * display symbol) so the trading components resolve a non-empty subscription
   * key. Only genuinely absent when a market predates resolution.
   * See docs/adr/0016-exchange-native-market-symbols.md.
   */
  hlCoin?: string
  /**
   * Maximum allowed leverage for the market. Present on perp & HIP-3 markets
   * (from the SDK perp meta `universe[i].maxLeverage`); absent for spot
   * (no leverage) and legacy mock-venue markets.
   */
  maxLeverage?: number
  /**
   * Whether candlestick data is available for this market.
   * Perp: true. Spot: true. HIP-3: false (no HL candle feed confirmed).
   */
  hasCandles?: boolean
  /** Live mark price (optional — populated by venues that source live ctxs). */
  markPrice?: number
  /** 24-hour percent change vs prior-day price (signed; optional). */
  change24hPct?: number
  /** 24-hour notional volume in quote currency (optional). */
  volume24h?: number
}

export interface OrderbookLevel {
  price: number
  size: number
}

export interface OrderbookSnapshot {
  kind: 'snapshot'
  symbol: string
  sequence: number
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  timestamp: number
}

export interface OrderbookDiff {
  kind: 'diff'
  symbol: string
  sequence: number
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  timestamp: number
}

export type OrderbookUpdate = OrderbookSnapshot | OrderbookDiff

export interface Trade {
  identifier: OrderIdentifier
  symbol: string
  side: Side
  price: number
  size: number
  timestamp: number
  /** Transaction hash on the venue's chain, when available (HL provides this on every WS trade; mock-venue omits). */
  transactionHash?: string
  /** The aggressor's wallet address (the side that crossed the spread), when the venue surfaces participants. */
  takerAddress?: WalletAddress
  /** The resting order's wallet address, when the venue surfaces participants. */
  makerAddress?: WalletAddress
}

/**
 * Initial set of recent trades delivered as the first emission after each
 * (re)subscribe. `trades` is newest-first and MAY be empty — a market with no
 * recent trades is a ready state, not a still-loading one. See ADR-0030.
 */
export interface TradesSnapshot {
  kind: 'snapshot'
  trades: Trade[]
}

/** A single trade appended live after the initial snapshot. See ADR-0030. */
export interface TradesAppend {
  kind: 'append'
  trade: Trade
}

/**
 * The trades stream mirrors the order book's readiness mechanism: a complete
 * `snapshot` first (so consumers flip out of loading in one step), then
 * `append` per live trade. See ADR-0030.
 */
export type TradesUpdate = TradesSnapshot | TradesAppend

/**
 * Fields common to every market type's live ticker.
 * Perp-only fields (indexPrice/openInterest/fundingRate/fundingCountdownSeconds)
 * live on `PerpTicker` only — a `SpotTicker` structurally cannot carry them
 * (D-04: discriminated union, not optional fields). Folds into the ADR-0013
 * backward-compat analysis (Phase 2 SC-2 mirror).
 */
export interface TickerBase {
  symbol: string
  markPrice: number
  open24h: number
  high24h: number
  low24h: number
  timestamp: number
}

/** Perp / HIP-3 ticker: carries oracle/index, open interest, and funding. */
export interface PerpTicker extends TickerBase {
  marketType: 'perp' | 'hip3'
  indexPrice: number
  openInterest: number
  fundingRate: number
  fundingCountdownSeconds: number
}

/** Spot ticker: no oracle/index, no open interest, no funding (HL spot ctx lacks them). */
export interface SpotTicker extends TickerBase {
  marketType: 'spot'
}

export type Ticker = PerpTicker | SpotTicker

export interface Position {
  symbol: string
  side: Side
  size: number
  entryPrice: number
  markPrice: number
  unrealisedProfitAndLoss: number
  leverage: number
  timestamp: number
}

/** Margin mode for a perp position. */
export type MarginMode = 'cross' | 'isolated'

/**
 * Time-in-force for a limit order.
 * - `Gtc` — good-til-cancelled (rests on the book).
 * - `Ioc` — immediate-or-cancel (fill what crosses, cancel the rest).
 * - `Alo` — add-liquidity-only (post-only; rejected if it would cross).
 */
export type OrderTimeInForce = 'Gtc' | 'Ioc' | 'Alo'

/** Client-generated order id (cloid). Threaded into the signed order and used
 *  to key the optimistic-feedback toast against the live stream. */
export type ClientOrderId = string

/**
 * How a trigger leg's trigger price is expressed.
 * - `price` — an absolute trigger price.
 * - `percent` — a percentage offset from the reference (entry / mark) price;
 *   the venue adapter resolves it to an absolute price at submit time.
 */
export type TriggerSpec =
  | { type: 'price'; price: number }
  | { type: 'percent'; percent: number }

/**
 * A take-profit or stop-loss leg attached to an order or position. `limitPrice`
 * is optional — absent means a market trigger (close at the trigger), present
 * means a trigger that places a limit order at `limitPrice` (trigger-limit).
 * `size` is optional — for a position-protection leg, the portion of the
 * position to protect in base-asset units; absent ⇒ the full position size
 * (preserves the existing trigger-market / full-size behaviour). See ADR-0054.
 */
export interface TriggerLeg {
  kind: 'take-profit' | 'stop-loss'
  trigger: TriggerSpec
  limitPrice?: number
  size?: number
}

/**
 * Fields shared by every place-order request. `takeProfit` / `stopLoss` legs
 * are optional protection attached at entry (HL grouping `normalTpsl`, fixed to
 * the entry size — see PRD decision 4). `clientOrderId` is the cloid.
 */
export interface PlaceOrderRequestBase {
  symbol: string
  side: Side
  size: number
  reduceOnly?: boolean
  takeProfit?: TriggerLeg
  stopLoss?: TriggerLeg
  clientOrderId?: ClientOrderId
}

/** A simulated market order — an aggressive IOC priced off top-of-book at
 *  `slippageTolerance` (fraction, e.g. 0.05 for 5%; default applied by the
 *  venue adapter when absent). */
export interface MarketOrderRequest extends PlaceOrderRequestBase {
  orderType: 'market'
  slippageTolerance?: number
}

/** A limit order resting at `price` with the given time-in-force. */
export interface LimitOrderRequest extends PlaceOrderRequestBase {
  orderType: 'limit'
  price: number
  timeInForce: OrderTimeInForce
}

/** A stop-market order: triggered at `stopPrice`, executes as a market order
 *  (aggressive IOC) priced off top-of-book at `slippageTolerance` (fraction,
 *  e.g. 0.05 for 5%; adapter default applied when absent). HL maps it to a
 *  native trigger order with `isMarket: true`. See ADR-0034 D-1. */
export interface StopMarketOrderRequest extends PlaceOrderRequestBase {
  orderType: 'stop-market'
  stopPrice: number
  slippageTolerance?: number
}

/** A stop-limit order: triggered at `stopPrice`, then rests as a limit order at
 *  `price` with the given time-in-force (defaults `Gtc` in the adapter; the UI
 *  does not expose it). HL maps it to a native trigger order with
 *  `isMarket: false`. See ADR-0034 D-1. */
export interface StopLimitOrderRequest extends PlaceOrderRequestBase {
  orderType: 'stop-limit'
  stopPrice: number
  price: number
  timeInForce?: OrderTimeInForce
}

/** A native Hyperliquid TWAP order: the total `size` is sliced and executed
 *  over `durationMinutes` (clamp 5..1440 / 5m–24h). `randomize` jitters slice
 *  sizing/timing. HL maps it to the native `twapOrder` action. See ADR-0034 D-1. */
export interface TwapOrderRequest extends PlaceOrderRequestBase {
  orderType: 'twap'
  durationMinutes: number
  randomize: boolean
}

export type PlaceOrderRequest =
  | MarketOrderRequest
  | LimitOrderRequest
  | StopMarketOrderRequest
  | StopLimitOrderRequest
  | TwapOrderRequest

/** Modify a resting order in place (no cancel-and-replace). At least one of
 *  `price` / `size` should be present. */
export interface ModifyOrderRequest {
  identifier: OrderIdentifier
  price?: number
  size?: number
}

export interface Order {
  identifier: OrderIdentifier
  symbol: string
  side: Side
  size: number
  price: number
  filledSize: number
  status: OrderStatus
  orderType: 'limit' | 'market'
  timestamp: number
  /** Original size at placement. Absent ⇒ fall back to `size`. The current
   *  (remaining) size is `size - filledSize`. See ADR-0023. */
  originalSize?: number
  /** Whether the order can only reduce an existing position. Absent ⇒ render
   *  `--`. See ADR-0023. */
  reduceOnly?: boolean
  /** Human-readable trigger condition (e.g. 'Price ≥ 1234.5'); absent for
   *  non-trigger orders. See ADR-0023. */
  triggerConditions?: string
  /** Trigger price for stop/TP/SL orders. Absent on non-trigger orders.
   *  See ADR-0051. */
  triggerPrice?: number
  /** True when the venue tagged this order as a position TP/SL resting order.
   *  See ADR-0051. */
  isPositionTpsl?: boolean
  /** Discriminates TP from SL for resting position-protection orders. Absent
   *  when the kind cannot be determined. See ADR-0051. */
  triggerKind?: 'tp' | 'sl'
}

export interface Fill {
  identifier: OrderIdentifier
  orderIdentifier: OrderIdentifier
  symbol: string
  side: Side
  price: number
  size: number
  fee: number
  timestamp: number
  /** Realised PnL booked by this fill (quote currency). Absent ⇒ render `--`.
   *  See ADR-0023. */
  closedPnl?: number
  /** Venue-reported direction/type label (e.g. 'Open Long', 'Close Short',
   *  'Buy'). Display-only; absent ⇒ fall back to `side`. See ADR-0023. */
  direction?: string
  /** Venue-reported taker flag — `true` ⇒ the fill crossed the spread (Taker),
   *  `false` ⇒ Maker. **`false` ≠ absent**: absent ⇒ render `--`. See ADR-0023. */
  crossed?: boolean
  /** Token the fee is denominated in (e.g. `'USDC'`). Display-only — the fee is
   *  shown verbatim in this token, never converted. Absent ⇒ assume `'USDC'`.
   *  See ADR-0023. */
  feeToken?: string
}

/**
 * Fields shared by every place-order outcome. `clientOrderId` echoes the cloid
 * the caller threaded in (when present), so the feedback layer can reconcile
 * the pending toast against the live stream.
 */
export interface PlaceOrderOutcomeBase {
  orderIdentifier: OrderIdentifier
  clientOrderId?: ClientOrderId
  symbol: string
  timestamp: number
}

/** The order rested on the book unfilled. */
export interface RestingOrderOutcome extends PlaceOrderOutcomeBase {
  kind: 'resting'
}

/** The order filled completely at `averagePrice` for `filledSize`. */
export interface FilledOrderOutcome extends PlaceOrderOutcomeBase {
  kind: 'filled'
  averagePrice: number
  filledSize: number
}

/** The order partially filled; `remainingSize` rests or was cancelled (IOC). */
export interface PartiallyFilledOrderOutcome extends PlaceOrderOutcomeBase {
  kind: 'partially-filled'
  averagePrice: number
  filledSize: number
  remainingSize: number
}

/**
 * Discriminated outcome of a successful place-order call. A `status: "ok"`
 * envelope from the venue can still carry per-order rejections — those map to
 * a `PlaceOrderError` (the err branch), never to an outcome. See PRD decision 5.
 */
export type PlaceOrderOutcome =
  | RestingOrderOutcome
  | FilledOrderOutcome
  | PartiallyFilledOrderOutcome

/**
 * The five order types a venue's order ticket can submit, venue-agnostic.
 * `market`/`limit` are always available; `stop-market`/`stop-limit`/`twap` are
 * Pro types surfaced behind their venue capability flags. Mirrors the literal
 * union the `trading/` order-entry panel uses (`OrderType` there); lives here so
 * the venue-owned `OrderDraft` can name it without importing `trading/`.
 * See ADR-0035 D-1.
 */
export type OrderType = 'market' | 'limit' | 'stop-market' | 'stop-limit' | 'twap'

/**
 * Whether the order-ticket size field is entered in base (coin) units or USD
 * margin (collateral). Venue-agnostic; mirrors the `trading/` `SizeUnit` literal
 * union so the venue-owned `OrderDraft` can name it without importing
 * `trading/`. See ADR-0035 D-1.
 */
export type SizeUnit = 'coin' | 'usd'

/**
 * A raw, un-parsed order ticket as the UI holds it: the form's string fields
 * plus the UI-owned context (`symbol`, `leverage`). The venue owns parsing — it
 * turns this into a typed `PlaceOrderRequest` (`validateDraft`) or field-tagged
 * issues, and prices it (`previewOrder`). Crossing the port as raw strings is
 * deliberate ("parse, don't validate"): there is exactly one parser per venue,
 * shared between the pre-check and `placeOrder`, so the client pre-check can
 * never drift from the venue's own acceptance. See ADR-0035 D-1 / D-2.
 *
 * The draft is **self-describing**: it names the market it targets via `symbol`,
 * and the venue resolves every per-market datum (mark price, asset metadata,
 * open position, available margin) from that symbol — never from an ambient
 * active-ticker subscription. This is what lets a SOL suggestion validate
 * against SOL while the terminal shows BTC. See ADR-0057.
 */
export interface OrderDraft {
  /** The market the draft targets. The venue resolves all per-market data
   *  (mark, asset, position, margin) from this symbol — NOT from any ambient
   *  active-ticker subscription. See ADR-0057. */
  symbol: string
  orderType: OrderType
  side: Side
  sizeUnit: SizeUnit
  sizeInput: string
  priceInput: string
  stopPriceInput: string
  slippageInput: string
  timeInForce: OrderTimeInForce
  twapHoursInput: string
  twapMinutesInput: string
  randomize: boolean
  reduceOnly: boolean
  /** The leverage the user selected — `trading/` owns the selection; it travels
   *  in the draft so the venue can price margin / liquidation. */
  leverage: number
}

/**
 * Which order-ticket field an `OrderIssue` is attached to. `trading/` uses the
 * tag to mark the right input invalid and place the message inline, preserving
 * the per-field inline-error UX. See ADR-0035 D-3.
 */
export type OrderField = 'size' | 'price' | 'stopPrice' | 'slippage' | 'twapDuration'

/**
 * A single venue-authored validation issue against a draft. Flat by design — no
 * `severity` / `source` (ADR-0035 D-9): scope is deterministic hard-blocks, so
 * every pre-submit issue is a blocking error. The optional `field` tag lets
 * `trading/` surface the message inline; `message` is the venue's own copy,
 * rendered verbatim.
 */
export interface OrderIssue {
  field?: OrderField
  message: string
}

/**
 * Type-aware pre-trade estimates for the order-ticket summary footer,
 * venue-agnostic. The venue owns the math (notional / margin / liquidation /
 * fee, or the TWAP slicing) and pulls mark price / taker rate / margin model
 * internally. `kind` discriminates the per-type footer rows. See ADR-0035 D-4.
 */
export type OrderEstimates = LinearOrderEstimates | TwapOrderEstimates

/** Market / limit / stop estimates. `liquidationPrice` is 0 for non-market
 *  types (the footer omits the liq row outside market). */
export interface LinearOrderEstimates {
  kind: 'linear'
  notional: number
  margin: number
  liquidationPrice: number
  fee: number
  hasBuilderFee: boolean
}

/** TWAP slicing estimates. `notional` is the total order value (coin × mark) the
 *  schedule works through — mirrors the linear estimate's `notional` so the %
 *  slider can back-compute the coin size for a TWAP draft too. */
export interface TwapOrderEstimates {
  kind: 'twap'
  notional: number
  frequencySeconds: number
  runtimeMinutes: number
  numberOfOrders: number
  sizePerSuborder: number
  fee: number
  hasBuilderFee: boolean
}

/**
 * Order capacity for the current draft — the single source the % slider / MAX
 * affordance sizes off. The venue computes it from buying power / margin model.
 * See ADR-0035 D-4.
 */
export interface OrderCapacity {
  maxCoinSize: number
}

export type Unsubscribe = () => void

/**
 * Minimal liveness source consumed by `withReconnect`. When it fires, the
 * helper tears down the live subscription and reconnects, routing through the
 * normal `reconnecting → connected → onResync` path. Used to recover a socket
 * that died silently (e.g. a backgrounded tab the OS suspended) without waiting
 * for a `failureSignal` that never fires while the JS loop is frozen.
 * See ADR-0041.
 */
export interface ResyncSignal {
  subscribe(onResync: () => void): Unsubscribe
}

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'

export interface Candle {
  symbol: string
  interval: Interval
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * A full window of candles, replacing the consumer's series in one bulk
 * `setData`. Emitted at initial subscribe and on every *re*connect resync
 * (ADR-0041) — replacing the previous per-candle replay that fast-forwarded the
 * chart through a buffered backlog ("10× replay" after a tab resume). `candles`
 * is strictly ascending by `openTime`.
 */
export interface CandleSnapshot {
  kind: 'snapshot'
  candles: Candle[]
}

/** A newly-opened bar appended after the current snapshot. */
export interface CandleNew {
  kind: 'new'
  candle: Candle
}

/** An in-place update to the latest bar. */
export interface CandleTick {
  kind: 'update'
  candle: Candle
}

export type CandleUpdate = CandleSnapshot | CandleNew | CandleTick
