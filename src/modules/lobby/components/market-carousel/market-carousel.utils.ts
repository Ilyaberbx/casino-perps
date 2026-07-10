/** Fraction (`0.024`) → percentage number the poster card expects (`2.4`). */
export function toChangePct(fraction: number | undefined): number {
  return (fraction ?? 0) * 100
}
