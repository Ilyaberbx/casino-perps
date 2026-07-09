import type { CSSProperties } from 'react'

/**
 * One tick notch on the slider track. `value` is the domain value the notch
 * sits at; `label` is the optional scale caption rendered beneath the rail
 * (omit to draw a bare notch with no caption).
 */
export interface PixelSliderTick {
  value: number
  label?: string
}

/**
 * The danger ramp tints the fill + thumb as the value approaches `max` — used
 * by the leverage slider (calm teal → amber → red near the per-market ceiling).
 * Absent on the neutral Amount slider, which stays accent-teal throughout.
 */
export type PixelSliderTone = 'accent' | 'danger-ramp'

export interface PixelSliderProps {
  value: number
  min: number
  max: number
  step?: number
  /** Tick notches (and optional captions) at notable domain values. */
  ticks?: ReadonlyArray<PixelSliderTick>
  tone?: PixelSliderTone
  ariaLabel: string
  /** Optional `data-testid` for the underlying range input (test targeting). */
  testId?: string
  disabled?: boolean
  /** Live drag/keyboard updates (every intermediate value). */
  onChange: (value: number) => void
  /** Commit-on-release: pointer-up / key-up. Omit for change-only sliders. */
  onCommit?: () => void
}

/** Typed CSS custom properties the dumb component writes for runtime fill %. */
export interface PixelSliderStyle extends CSSProperties {
  '--pixel-slider-fill': string
  '--pixel-slider-tone': string
}
