/**
 * Default market-order slippage tolerance (fraction). A market order is a
 * simulated aggressive IOC priced off top-of-book × (1 ± this) (PRD decision 9).
 * User-overridable via `MarketOrderRequest.slippageTolerance`.
 */
export const DEFAULT_MARKET_SLIPPAGE_TOLERANCE = 0.05

/**
 * Time-in-force used for the simulated market order's IOC leg. `FrontendMarket`
 * is HL's IOC variant that also flags the order as a market order to the UI; it
 * behaves like `Ioc` for matching (fill what crosses, cancel the remainder).
 */
export const MARKET_ORDER_TIF = 'FrontendMarket' as const

/** Grouping for a standalone order with no attached protection. */
export const GROUPING_NONE = 'na' as const

/** Grouping for entry-attached TP/SL (fixed to the entry size). */
export const GROUPING_NORMAL_TPSL = 'normalTpsl' as const

/** Grouping for position-level TP/SL — scales with the position (PRD dec. 4). */
export const GROUPING_POSITION_TPSL = 'positionTpsl' as const

/**
 * TWAP duration clamp (minutes). Hyperliquid's native `twapOrder` action accepts
 * `5 ≤ m ≤ 1440` (5 minutes – 24 hours), enforced by the SDK's valibot schema.
 * The trader clamps `durationMinutes` into this range before issuing so a UI
 * off-by-one never reaches a hard SDK validation throw (ADR-0034 D-1/D-3).
 */
export const TWAP_MIN_DURATION_MINUTES = 5
export const TWAP_MAX_DURATION_MINUTES = 1440

/**
 * Hyperliquid rejects any opening order whose value (notional = size × price) is
 * below $10 (`minTradeNtlRejected`; mirrors HL's `size * ideal_price < 10`).
 * Reduce-only / closing orders are exempt. The venue's `validateDraft` blocks
 * client-side so the ticket disables submit with a clear hint instead of
 * surfacing the opaque venue rejection after the round-trip. A venue fact —
 * relocated here from `trading/` (ADR-0035 D-7).
 */
export const MIN_ORDER_VALUE_USD = 10

/**
 * Slippage tolerance band for market / stop-market orders, as a percent. The
 * field is `0 < p ≤ MAX`; an over-cap value is clamped so a fat-finger cannot
 * send a 1000% IOC, a non-positive / non-numeric value is rejected (the
 * originating "negative slippage executes" bug), and an empty field falls back
 * to the venue default. Venue facts — relocated from `trading/` (ADR-0035 D-7).
 * `DEFAULT_SLIPPAGE_PERCENT` mirrors `DEFAULT_MARKET_SLIPPAGE_TOLERANCE` (×100):
 * one parser ⇒ one default closes the prior divergence (ADR-0035 D-2).
 */
export const MAX_SLIPPAGE_PERCENT = 50
export const DEFAULT_SLIPPAGE_PERCENT = DEFAULT_MARKET_SLIPPAGE_TOLERANCE * 100

/**
 * Hyperliquid TWAP sub-order interval — a constant 30 seconds. The preview
 * sub-order count is `floor(runtimeSeconds / 30) + 1`. Venue fact relocated
 * from `trading/` (ADR-0035 D-7).
 */
export const TWAP_FREQUENCY_SECONDS = 30
