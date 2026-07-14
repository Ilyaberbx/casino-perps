/** Fraction (`0.024`) → percentage number the poster card expects (`2.4`).
 *  The seam between `Market.change24hPct` (a fraction) and `MarketCardProps.changePct`
 *  (a percent). Both the carousel and the focused grid render cards, so this lives
 *  at the module root rather than beside either one. */
export function toChangePct(fraction: number | undefined): number {
  return (fraction ?? 0) * 100
}
