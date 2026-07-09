import type { ReactNode } from 'react'

export type ThemeVariant = 'dark' | 'white'

/**
 * The ten predefined accent colors the Settings → Appearance picker offers.
 * Free color entry is intentionally not supported — the id keys both the picker
 * and the persisted preference. `cyan` is the default and keeps the app's
 * existing electric-cyan accent verbatim.
 */
export type AccentColorId =
  | 'cyan'
  | 'sky'
  | 'lavender'
  | 'mauve'
  | 'blush'
  | 'coral'
  | 'peach'
  | 'sand'
  | 'sage'
  | 'mint'

/**
 * The accent token set applied for one theme variant. `rgb` is the comma triplet
 * of `accent`, fed to `--accent-rgb` so the derived soft/glow/gradient tokens in
 * `index.css` re-tint from a single override. `secondary` is the gradient end.
 */
export interface AccentColorVariant {
  readonly accent: string
  readonly hover: string
  readonly secondary: string
  readonly rgb: string
}

/** One swatch: an id, a human label, and a per-theme tuned variant. */
export interface AccentColor {
  readonly id: AccentColorId
  readonly label: string
  readonly dark: AccentColorVariant
  readonly white: AccentColorVariant
}

export interface ThemeProviderProps {
  children: ReactNode
}

export interface UseThemeProviderReturn {
  theme: ThemeVariant
  toggleTheme: () => void
  accentColorId: AccentColorId
  accentColors: ReadonlyArray<AccentColor>
  setAccentColor: (id: AccentColorId) => void
}
