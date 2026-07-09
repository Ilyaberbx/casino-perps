import type { Unsubscribe } from '../domain.types'

/**
 * Derived perp margin facts the Venue supplies for the equity card's health
 * surface (ADR-0072). Maintenance Margin / Account Leverage are **segregated-only**
 * — the cross maintenance margin / leverage are not meaningful for a unified /
 * portfolio-margin account, so those fields are `null` there and the card renders
 * `--`. `marginRatioPct` is `0` (not null) for a unified account (the reference
 * shows a green `0.00%` badge). `unrealizedPnlUsd` is populated for **both** modes
 * — it is summed across every dex's open positions (main + HIP-3). All values are
 * Venue-computed; the app only renders them.
 */
export interface MarginSummarySnapshot {
  /** Cross maintenance margin used (USD). `null` for unified accounts. */
  readonly maintenanceMarginUsd: number | null
  /** Cross account leverage = total cross position notional / cross account value. */
  readonly accountLeverage: number | null
  /** Account-health ratio: maintenance margin / cross account value, as a percent. */
  readonly marginRatioPct: number | null
  /** Live unrealized PnL summed across every dex's open positions (USD, both modes). */
  readonly unrealizedPnlUsd: number | null
  /** (a) Total cross positions value — the leverage tooltip numerator (USD). */
  readonly totalCrossPositionsValueUsd: number | null
  /** (b) Cross account value — the leverage tooltip denominator (USD, incl. uPnL). */
  readonly crossAccountValueUsd: number | null
}

/**
 * Venue-agnostic reader for the derived perp margin facts (Maintenance Margin,
 * Account Leverage, Margin Ratio, Unrealized PnL). Optional capability — a venue
 * without it yields the null/zero snapshot above (unified accounts still report
 * `unrealizedPnlUsd`; only Maintenance Margin / Leverage are null there).
 */
export interface MarginSummaryReader {
  subscribe(onUpdate: (snapshot: MarginSummarySnapshot) => void): Unsubscribe
}
