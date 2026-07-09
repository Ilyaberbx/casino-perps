import type { SuggestProgressStyle } from './perp-suggestion-sheet.types'

const PERCENT_MAX = 100

/**
 * Runtime fill width for the Suggest progress bar (per `frontend-architecture.md`:
 * style that depends on derived state lives in a `*.styles.ts`, not the CSS
 * module). Returns the typed CSS custom property the dumb stepper spreads onto the
 * fill segment. `fillFraction` is clamped to [0, 1] before scaling to a percent —
 * no `any`, no untyped record. Mirrors `pixel-slider.styles.ts`.
 */
export function suggestProgressStyle(fillFraction: number): SuggestProgressStyle {
  const clamped = Math.max(0, Math.min(1, fillFraction))
  return { '--suggest-progress-fill': `${clamped * PERCENT_MAX}%` }
}
