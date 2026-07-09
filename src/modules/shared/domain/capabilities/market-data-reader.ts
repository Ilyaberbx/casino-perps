import type {
  Market,
  OrderbookUpdate,
  TradesUpdate,
  Ticker,
  Unsubscribe,
} from '../domain.types'

/**
 * Options for `subscribeOrderbook`. Venues may use the display tick as a
 * hint to request server-side aggregation (HL: maps to `nSigFigs`), so the
 * stream returns enough distinct levels at the chosen precision instead of
 * a tight native book that collapses into 2–3 rows.
 */
export interface SubscribeOrderbookOptions {
  /** Client-side display tick. `0` or omitted means native (no aggregation). */
  readonly tick?: number
}

export interface MarketDataReader {
  /**
   * Triggers a (re)load of the market universe and notifies
   * `subscribeMarkets` listeners as data arrives. Idempotent and safe to
   * call on a cadence. Owned by the composition root's venue lifecycle
   * effect — not called at venue construction (ADR-0015).
   */
  refresh(): Promise<void>
  listMarkets(): Market[]
  subscribeMarkets(onChange: (markets: Market[]) => void): Unsubscribe
  subscribeOrderbook(
    symbol: string,
    onUpdate: (update: OrderbookUpdate) => void,
    opts?: SubscribeOrderbookOptions,
  ): Unsubscribe
  /**
   * Opens the venue's recent-trades stream. The first emission is a complete
   * `snapshot` (possibly empty), every later emission an `append`. Mirrors
   * `subscribeOrderbook`'s readiness mechanism. See ADR-0030.
   */
  subscribeTrades(
    symbol: string,
    onUpdate: (update: TradesUpdate) => void,
  ): Unsubscribe
  subscribeTicker(
    symbol: string,
    onTicker: (ticker: Ticker) => void,
  ): Unsubscribe
}
