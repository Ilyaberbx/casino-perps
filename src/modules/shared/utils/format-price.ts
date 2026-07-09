import type { Market, MarketType } from '@/modules/shared/domain'
import { numberFormat } from './intl-cache'

/** Significant figures Hyperliquid shows for a price (`3.1231`, `0.035531`). */
const SIGNIFICANT_FIGURES = 5
/** HL caps a perp/HIP-3 price at `6 - szDecimals` decimals; spot at `8 - szDecimals`. */
const PERP_MAX_DECIMALS = 6
const SPOT_MAX_DECIMALS = 8
/** Used before a price has streamed in (value 0/NaN) — a sensible mid default. */
const FALLBACK_DECIMALS = 2

/**
 * Build the price-format spec from a domain `Market`. `stepSize` is `10^-szDecimals`
 * (set in the HL market-data reader), so `szDecimals` is recovered by inverting it.
 * `marketType` is absent on legacy mock-venue markets — treat as `'perp'`.
 */
export function specFromMarket(market: Market): {
  szDecimals: number
  marketType: MarketType
} {
  // A synthesised pre-load market carries stepSize 0 (no universe yet); treat
  // it as szDecimals 0 so the cap stays wide until the real value streams in.
  const hasStep = Number.isFinite(market.stepSize) && market.stepSize > 0
  const szDecimals = hasStep ? Math.max(0, Math.round(-Math.log10(market.stepSize))) : 0
  return { szDecimals, marketType: market.marketType ?? 'perp' }
}

/**
 * Decimal places for a price, matching Hyperliquid's rule: at most 5 significant
 * figures, never finer than the asset's tradable precision (`maxDecimals`), and
 * integers (BTC at 77,744) keep zero decimals. Returned as the integer count so
 * lightweight-charts can derive `precision` + `minMove` from it.
 *
 * Pure — no React, no I/O, no module state.
 */
export function priceDecimals(
  value: number,
  spec: { szDecimals: number; marketType: MarketType },
): number {
  const isSpot = spec.marketType === 'spot'
  const maxFloor = isSpot ? SPOT_MAX_DECIMALS : PERP_MAX_DECIMALS
  const maxDecimalsCap = Math.max(0, maxFloor - spec.szDecimals)

  const hasMagnitude = Number.isFinite(value) && value > 0
  if (!hasMagnitude) return Math.min(FALLBACK_DECIMALS, maxDecimalsCap)

  const integerDigits = Math.floor(Math.log10(value)) + 1
  const sigFigCap = Math.max(0, SIGNIFICANT_FIGURES - integerDigits)
  return Math.min(sigFigCap, maxDecimalsCap)
}

/**
 * Render a price with magnitude-aware decimals (see `priceDecimals`), 1000s
 * grouping, and trailing zeros stripped (`77,744`, `3.1231`, `0.035531`).
 *
 * Pure — no React, no I/O, no module state.
 */
export function formatPrice(
  value: number,
  spec: { szDecimals: number; marketType: MarketType },
): string {
  const decimals = priceDecimals(value, spec)
  return numberFormat({
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}
