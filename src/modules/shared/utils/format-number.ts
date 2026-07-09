// Shared number formatting for account/portfolio surfaces. Centralises the
// "USD value" and "token amount" display rules so panels stop hand-rolling
// `toLocaleString()` with inconsistent precision (the account-dock balance
// display bug: raw float tails + USD values with no fixed decimals).

import { numberFormat } from './intl-cache'

const DEFAULT_AMOUNT_MAX_DECIMALS = 3
const SIGNIFICANT_FIGURES_FOR_SUB_PRECISION = 2

/**
 * Pick a `maximumFractionDigits` that respects the requested cap but never
 * lets a non-zero value round to "0" at the cap. For sub-precision values
 * (|v| < 10^-maxDecimals) widen to enough digits to show
 * `SIGNIFICANT_FIGURES_FOR_SUB_PRECISION` significant figures, so a $0.000027
 * mark price renders `0.000027` instead of `0.000`.
 */
function effectiveMaxDecimals(value: number, maxDecimals: number): number {
  const absValue = Math.abs(value)
  const isZero = absValue === 0
  if (isZero) return maxDecimals
  const fitsCap = absValue >= Math.pow(10, -maxDecimals)
  if (fitsCap) return maxDecimals
  const leadingZeros = -Math.floor(Math.log10(absValue)) - 1
  return leadingZeros + SIGNIFICANT_FIGURES_FOR_SUB_PRECISION
}

/**
 * Format a USD value: thousands-grouped, exactly 2 decimals, `$` prefixed.
 * `signed` forces a leading `+` on non-negative values (for PnL columns).
 * Negative values render as `-$1,234.56`.
 */
export function formatUsd(value: number, options: { signed?: boolean } = {}): string {
  const isNegative = value < 0
  const grouped = numberFormat({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  const wantsLeadingPlus = options.signed === true && !isNegative
  const sign = isNegative ? '-' : wantsLeadingPlus ? '+' : ''
  return `${sign}$${grouped}`
}

/**
 * Format a token amount (balances, sizes, prices): thousands-grouped, up to
 * `maxDecimals` fractional digits with trailing zeros trimmed. Sub-precision
 * dust values widen automatically to retain significant figures (a $0.000027
 * price still renders fully, not as `0.000`).
 */
export function formatTokenAmount(
  value: number,
  maxDecimals: number = DEFAULT_AMOUNT_MAX_DECIMALS,
): string {
  const widenedMaxDecimals = effectiveMaxDecimals(value, maxDecimals)
  return numberFormat({
    minimumFractionDigits: 0,
    maximumFractionDigits: widenedMaxDecimals,
  }).format(value)
}
