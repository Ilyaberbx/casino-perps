import type { Side } from '@/modules/shared/domain'
import type { MarketSymbol } from './providers/selected-market-provider'

/**
 * Asset-class category for a market, mirroring Minara's market-browser tabs (a
 * 1:1 copy — see `docs/adr/0062-minara-market-catalog.md`). `crypto` is the
 * default bucket; the other five are driven by the explicit symbol sets in
 * `trading.constants.ts`. Consumed by the Market Selection Window tabs and the
 * AI-suggestion Market field grouping.
 */
export type MarketCategory =
  | 'crypto'
  | 'stocks'
  | 'commodities'
  | 'indices'
  | 'fx'
  | 'pre-ipo'

/** A Market Selection Window / AI-suggestion category tab value: a real
 *  `MarketCategory`, or `'all'` for the unfiltered tab. */
export type MarketCategoryTab = 'all' | MarketCategory

/** Sign of a 24h price move, used to colour a change cell. */
export type ChangeDirection = 'up' | 'down' | 'neutral'

/**
 * A presentation-ready 24h change: the signed, percent-formatted `display`
 * string (`+1.23%` / `-1.23%` / `0.00%`) and its `direction`. Derived from the
 * signed-fraction `change24hPct` by `deriveChangeDisplay`. Shared by the
 * market-selection-window rows and the hot-markets ticker so both read the same.
 */
export interface ChangeDisplay {
  readonly display: string
  readonly direction: ChangeDirection
}

/**
 * A prefill patch projected from a **Directional** engine outcome onto the order
 * ticket (issue #213, ADR-0045). It is a *suggestion to the order form* — the
 * user always confirms via the ticket's own Place Order. Carries the entry as a
 * limit order (`side` mapped from the engine's `long|short`, `priceInput` =
 * entry) plus the TP/SL trigger prices; leverage is **not** here — it is venue
 * account state applied separately through `LeverageController.setLeverage`
 * (PRD decision 12). `null` is produced for Delta-Neutral / No-Trade (nothing to
 * prefill).
 */
export interface OrderIntentPatch {
  /** The market the patch is bound to — order entry only applies it when it
   *  matches the active selected market (a stale patch never leaks across
   *  markets). */
  readonly symbol: MarketSymbol
  /** Engine `long` → `'buy'`, `short` → `'sell'`. */
  readonly side: Side
  /** A directional suggestion always prefills a limit entry. */
  readonly orderType: 'limit'
  /** The entry price as the limit `priceInput` string ('' when the engine gave
   *  no entry — the user fills it in). */
  readonly priceInput: string
  /** Take-profit trigger price as an input string (omitted when absent). */
  readonly takeProfitPriceInput?: string
  /** Stop-loss trigger price as an input string (omitted when absent). */
  readonly stopLossPriceInput?: string
}

/**
 * A published order intent the suggestion sheet hands to the order ticket via the
 * order-intent provider unit. The `patch` prefills the form; `leverage` (the
 * user's chosen leverage from the suggestion ask) is applied separately by the
 * sheet through `LeverageController.setLeverage` — it is never part of the
 * place-order request.
 */
export interface OrderIntent {
  readonly patch: OrderIntentPatch
  /** The chosen leverage to apply (separately) — `undefined` when none chosen. */
  readonly leverage?: number
}
