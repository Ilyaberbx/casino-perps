import type { CSSProperties } from 'react'

/**
 * The swatch fill is data-driven (one of ten accents), so the runtime value lives
 * here per the *.styles.ts rule. It is exposed as the `--swatch-color` custom
 * property so the stylesheet can drive both the fill and the selected ring from
 * one value. The cast is required because `CSSProperties` has no string index
 * signature for custom properties; the value is a fixed hex from `ACCENT_COLORS`.
 */
export function swatchStyle(accent: string): CSSProperties {
  return { '--swatch-color': accent } as CSSProperties
}
