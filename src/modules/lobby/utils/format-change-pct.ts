const CHANGE_FRACTION_DIGITS = 1

/**
 * Formats a 24h change chip value. Input is a percentage number where `2.4`
 * means `+2.4%` and `-3.15` means `-3.2%`. Always carries an explicit sign and a
 * single decimal so the chip width stays stable. `-0.0` normalizes to `+0.0%`.
 */
export function formatChangePct(pct: number): string {
  const isNegative = pct < 0
  const sign = isNegative ? '-' : '+'
  const magnitude = Math.abs(pct).toFixed(CHANGE_FRACTION_DIGITS)
  return `${sign}${magnitude}%`
}
