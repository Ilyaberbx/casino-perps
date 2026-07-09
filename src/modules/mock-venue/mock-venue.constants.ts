import type { Market } from '../shared/domain'

/** Max orderbook levels retained per side for display/aggregation. */
export const DISPLAY_DEPTH = 25

/** Synthetic order-acknowledgement latency bounds (milliseconds). */
export const MIN_ACK_LATENCY_MILLISECONDS = 50
export const MAX_ACK_LATENCY_MILLISECONDS = 150

// Readonly<Record> rather than `as const` so consumers can index by an arbitrary
// runtime symbol string without literal-key narrowing fighting them.
export const ANCHOR_PRICES: Readonly<Record<string, number>> = {
  'BTC-PERP': 65000,
  'ETH-PERP': 3500,
  'SOL-PERP': 150,
}

// Venue-fact order rules owned by the mock (ADR-0035 D-7: these numbers live
// with the venue's validation schema, not in venue-agnostic `trading/`).
// Min opening order value (notional = size × mark price). Reduce-only / closing
// orders are exempt.
export const MOCK_MIN_ORDER_VALUE_USD = 10
// Market-order slippage band: 0 < percent ≤ MAX.
export const MOCK_MAX_SLIPPAGE_PERCENT = 50
// Default slippage percent applied when the field is empty (the single default —
// closing ADR-0035's default-divergence gap for the mock).
export const MOCK_DEFAULT_SLIPPAGE_PERCENT = 8
// TWAP running-time clamp (minutes): 5m to 24h.
export const MOCK_MIN_TWAP_DURATION_MINUTES = 5
export const MOCK_MAX_TWAP_DURATION_MINUTES = 1440
// TWAP sub-order cadence (seconds) — fixed 30s; count = floor(runtimeSeconds/30)+1.
export const MOCK_TWAP_FREQUENCY_SECONDS = 30
// Flat taker fee rate the mock prices estimates off (fraction, ~4.5 bps).
export const MOCK_TAKER_RATE = 0.00045

// ReadonlyArray<Market> rather than `as const` so the array widens to the Market
// domain type; the literal-tuple form would over-narrow venue/quoteAsset fields.
// `hlCoin` is the subscription key the trading components resolve markets by
// (`market.hlCoin ?? SUBSCRIPTION_KEY_NONE`). The mock's generators key off the
// symbol, so hlCoin === symbol. Without it the components fall back to the
// empty-string sentinel and skip the orderbook/trades subscribe entirely.
export const MARKETS: ReadonlyArray<Market> = [
  {
    symbol: 'BTC-PERP',
    hlCoin: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.5,
    stepSize: 0.001,
  },
  {
    symbol: 'ETH-PERP',
    hlCoin: 'ETH-PERP',
    baseAsset: 'ETH',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.05,
    stepSize: 0.01,
  },
  {
    symbol: 'SOL-PERP',
    hlCoin: 'SOL-PERP',
    baseAsset: 'SOL',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.01,
    stepSize: 0.1,
  },
]
