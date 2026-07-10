const PCT_FRACTION_DIGITS = 1

/** A signed 24h change fraction (`0.024`) → a display string (`+2.4%`). */
export function formatChange(fraction: number): string {
  const pct = fraction * 100
  const sign = pct < 0 ? '' : '+'
  return `${sign}${pct.toFixed(PCT_FRACTION_DIGITS)}%`
}
