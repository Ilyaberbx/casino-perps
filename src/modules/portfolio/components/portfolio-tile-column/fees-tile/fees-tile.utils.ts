/** Max precision the fee schedule is quoted at (basis points → 4 percent decimals). */
const FEE_PERCENT_MAX_DECIMALS = 4
/** Always keep at least one decimal so a trimmed fee never reads as a bare integer. */
const FEE_PERCENT_MIN_DECIMALS = 1

/**
 * Drop trailing zeros from a fixed-decimal string while preserving at least
 * `minDecimals` fractional digits. `"0.0450"` → `"0.045"`, `"0.0700"` →
 * `"0.07"`, `"1.0000"` → `"1.0"`. Display-only — the underlying number is
 * untouched (#277).
 */
function trimTrailingZeros(fixed: string, minDecimals: number): string {
  const [intPart, fracRaw = ''] = fixed.split('.')
  const withoutTrailingZeros = fracRaw.replace(/0+$/, '')
  const isBelowMinimum = withoutTrailingZeros.length < minDecimals
  const frac = isBelowMinimum
    ? withoutTrailingZeros.padEnd(minDecimals, '0')
    : withoutTrailingZeros
  return `${intPart}.${frac}`
}

/**
 * Format a basis-point fee as a percent string with redundant trailing zeros
 * trimmed to significant digits (#277): `4.5` bps → `"0.045%"`. A literal-zero
 * fee renders `"0%"` (no decimals). The numbers are never changed — this is
 * purely how the fee is displayed.
 */
export function formatFeePercent(bps: number): string {
  const percent = bps / 100
  if (percent === 0) return '0%'
  const fixed = percent.toFixed(FEE_PERCENT_MAX_DECIMALS)
  return `${trimTrailingZeros(fixed, FEE_PERCENT_MIN_DECIMALS)}%`
}
