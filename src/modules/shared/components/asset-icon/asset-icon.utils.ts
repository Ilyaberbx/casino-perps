import { LETTER_BG_RAMP } from './asset-icon.constants'

/**
 * Returns a deterministic background color for the letter placeholder.
 * The color is derived from the first character of the asset's baseAsset string.
 * Same letter always maps to same color — no per-render drift.
 *
 * @param letter - single uppercase character (market.baseAsset[0])
 */
export function letterColor(letter: string): string {
  const code = letter.toUpperCase().charCodeAt(0) - 65
  return LETTER_BG_RAMP[Math.abs(code) % LETTER_BG_RAMP.length] ?? LETTER_BG_RAMP[0] ?? 'var(--accent)'
}
