import type { PixelSliderTone } from './pixel-slider.types'

/** A value's position along the track as a 0–1 fraction, clamped to the rail. */
export function trackFraction(value: number, min: number, max: number): number {
  const span = max - min
  if (span <= 0) return 0
  const raw = (value - min) / span
  if (raw < 0) return 0
  if (raw > 1) return 1
  return raw
}

/** The same fraction as a `%` string for a CSS custom property. */
export function trackPercent(value: number, min: number, max: number): string {
  return `${trackFraction(value, min, max) * 100}%`
}

/**
 * The danger-ramp tone color for a value approaching `max`. The neutral
 * `'accent'` tone always resolves to `--accent`. The `'danger-ramp'` tone stays
 * teal below the warn threshold, shifts to `--warning` (amber) in the upper
 * band, and to `--directionDown` (red) near the ceiling — so the leverage fill
 * visibly heats up as the draft nears the per-market max. Returns a design-token
 * `var(...)` reference, never a hex literal.
 */
const RAMP_WARN_FRACTION = 0.7
const RAMP_DANGER_FRACTION = 0.9

export function toneColor(tone: PixelSliderTone, fraction: number): string {
  if (tone === 'accent') return 'var(--accent)'
  const isDanger = fraction >= RAMP_DANGER_FRACTION
  if (isDanger) return 'var(--directionDown)'
  const isWarn = fraction >= RAMP_WARN_FRACTION
  if (isWarn) return 'var(--warning)'
  return 'var(--accent)'
}
