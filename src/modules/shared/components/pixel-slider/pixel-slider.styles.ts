import type { PixelSliderStyle, PixelSliderTone } from './pixel-slider.types'
import { toneColor, trackFraction } from './pixel-slider.utils'

/**
 * Runtime-dependent slider styling lives here (per `frontend-architecture.md`:
 * styles that depend on props/state go in a `*.styles.ts`, not the CSS module).
 * Returns the typed CSS custom properties the dumb component spreads onto the
 * track wrapper: the fill-progress width and the tone color (which heats up on
 * the leverage danger ramp). No `any`, no untyped record.
 */
export function pixelSliderStyle(
  value: number,
  min: number,
  max: number,
  tone: PixelSliderTone,
): PixelSliderStyle {
  const fraction = trackFraction(value, min, max)
  return {
    '--pixel-slider-fill': `${fraction * 100}%`,
    '--pixel-slider-tone': toneColor(tone, fraction),
  }
}
