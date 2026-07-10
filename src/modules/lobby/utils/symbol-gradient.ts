/**
 * Deterministic poster-card gradient for a market symbol (PRD 0008 D9).
 *
 * Pure and stable: the same symbol always yields the same gradient, so BTC's
 * card looks identical on every render and across sessions. No randomness, no
 * time, no module state.
 *
 * Output is a CSS `background` value: a subtle radial highlight layered over a
 * two-stop 160deg linear gradient. Hues are drawn only from a curated neon /
 * casino register (violet, indigo, blue, teal, magenta, hot-pink) and stops keep
 * high saturation, so a card never lands in muddy yellow-green-brown territory.
 */

/**
 * Anchor hues, all inside the neon register. The symbol hash selects one as the
 * gradient's first stop; the second stop is a bounded clockwise rotation from it,
 * which — for every anchor — stays inside the same neon band (violet↔pink,
 * indigo↔magenta, teal↔blue), never crossing into mud.
 */
const NEON_ANCHOR_HUES = [265, 230, 210, 190, 305, 325] as const

const HUE_SPREAD_MIN = 32
const HUE_SPREAD_RANGE = 40

const STOP_ONE_SATURATION = 82
const STOP_ONE_LIGHTNESS = 26
const STOP_TWO_SATURATION = 88
const STOP_TWO_LIGHTNESS = 46
const HIGHLIGHT_SATURATION = 92
const HIGHLIGHT_LIGHTNESS = 62

const FULL_TURN = 360

/**
 * FNV-1a 32-bit hash of a string, returned as an unsigned integer. Chosen for
 * being tiny, dependency-free, and well-distributed for short ticker strings.
 */
function hashSymbol(symbol: string): number {
  let hash = 2166136261
  for (let index = 0; index < symbol.length; index += 1) {
    hash ^= symbol.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function symbolGradient(symbol: string): string {
  const hash = hashSymbol(symbol)

  const anchorIndex = hash % NEON_ANCHOR_HUES.length
  const baseHue = NEON_ANCHOR_HUES[anchorIndex]

  const hueSpread = HUE_SPREAD_MIN + ((hash >>> 3) % HUE_SPREAD_RANGE)
  const secondHue = (baseHue + hueSpread) % FULL_TURN

  const linear = `linear-gradient(160deg, hsl(${baseHue} ${STOP_ONE_SATURATION}% ${STOP_ONE_LIGHTNESS}%) 0%, hsl(${secondHue} ${STOP_TWO_SATURATION}% ${STOP_TWO_LIGHTNESS}%) 100%)`
  const highlight = `radial-gradient(120% 95% at 28% 18%, hsl(${secondHue} ${HIGHLIGHT_SATURATION}% ${HIGHLIGHT_LIGHTNESS}% / 0.42) 0%, hsl(${secondHue} ${HIGHLIGHT_SATURATION}% ${HIGHLIGHT_LIGHTNESS}% / 0) 55%)`

  return `${highlight}, ${linear}`
}
