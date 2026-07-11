import type { AccentColor, AccentColorId } from './theme-provider.types'

export const THEME_STORAGE_KEY = 'perps-dex-theme'
export const DEFAULT_THEME = 'dark' as const
export const DATA_THEME_ATTRIBUTE = 'data-theme'

export const ACCENT_COLOR_STORAGE_KEY = 'perps-dex-accent-color'
/**
 * The pre-#256 key the accent color was stored under ("Primary Color"). Read once
 * on load for the one-time forward migration in `use-theme-provider.ts`, then
 * deleted — existing users keep their chosen colour under the new key.
 */
export const LEGACY_ACCENT_COLOR_STORAGE_KEY = 'perps-dex-primary-color'
export const DEFAULT_ACCENT_COLOR_ID: AccentColorId = 'cyan'

/**
 * Favicon per theme. The casino brand has a single dark-only YEET tile
 * (`public/favicon.svg`), so both theme keys resolve to it — the map shape is
 * kept because `use-theme-provider` swaps by theme key.
 */
export const FAVICON_HREF_BY_THEME = {
  dark: '/favicon.svg',
  white: '/favicon.svg',
} as const

/**
 * The ten predefined accent colors. Pastel/muted palette tuned for the dark
 * neon UI; each swatch ships a `dark` variant (soft pastel) and a deeper `white`
 * variant so contrast holds when the user toggles the white theme. `cyan` is the
 * default and mirrors the existing `index.css` accent tokens verbatim, so a
 * first-run user sees no change. `rgb` is the comma triplet of the variant's
 * `accent`, written to `--accent-rgb`; `secondary` is the gradient end.
 */
export const ACCENT_COLORS: ReadonlyArray<AccentColor> = [
  {
    id: 'cyan',
    label: 'Cyan',
    dark: { accent: '#22d3ee', hover: '#67e8f9', secondary: '#0e7490', rgb: '34, 211, 238' },
    white: { accent: '#0e7490', hover: '#155e75', secondary: '#155e75', rgb: '14, 116, 144' },
  },
  {
    id: 'sky',
    label: 'Sky',
    dark: { accent: '#93c5fd', hover: '#bfdbfe', secondary: '#2563eb', rgb: '147, 197, 253' },
    white: { accent: '#2563eb', hover: '#1d4ed8', secondary: '#1d4ed8', rgb: '37, 99, 235' },
  },
  {
    id: 'lavender',
    label: 'Lavender',
    dark: { accent: '#c4b5fd', hover: '#ddd6fe', secondary: '#7c3aed', rgb: '196, 181, 253' },
    white: { accent: '#7c3aed', hover: '#6d28d9', secondary: '#6d28d9', rgb: '124, 58, 237' },
  },
  {
    id: 'mauve',
    label: 'Mauve',
    dark: { accent: '#f0abfc', hover: '#f5d0fe', secondary: '#c026d3', rgb: '240, 171, 252' },
    white: { accent: '#c026d3', hover: '#a21caf', secondary: '#a21caf', rgb: '192, 38, 211' },
  },
  {
    id: 'blush',
    label: 'Blush',
    dark: { accent: '#f9a8d4', hover: '#fbcfe8', secondary: '#db2777', rgb: '249, 168, 212' },
    white: { accent: '#db2777', hover: '#be185d', secondary: '#be185d', rgb: '219, 39, 119' },
  },
  {
    id: 'coral',
    label: 'Coral',
    dark: { accent: '#fca5a5', hover: '#fecaca', secondary: '#dc2626', rgb: '252, 165, 165' },
    white: { accent: '#dc2626', hover: '#b91c1c', secondary: '#b91c1c', rgb: '220, 38, 38' },
  },
  {
    id: 'peach',
    label: 'Peach',
    dark: { accent: '#fdba74', hover: '#fed7aa', secondary: '#ea580c', rgb: '253, 186, 116' },
    white: { accent: '#ea580c', hover: '#c2410c', secondary: '#c2410c', rgb: '234, 88, 12' },
  },
  {
    id: 'sand',
    label: 'Sand',
    dark: { accent: '#fcd34d', hover: '#fde68a', secondary: '#ca8a04', rgb: '252, 211, 77' },
    white: { accent: '#ca8a04', hover: '#a16207', secondary: '#a16207', rgb: '202, 138, 4' },
  },
  {
    id: 'sage',
    label: 'Sage',
    dark: { accent: '#bef264', hover: '#d9f99d', secondary: '#65a30d', rgb: '190, 242, 100' },
    white: { accent: '#65a30d', hover: '#4d7c0f', secondary: '#4d7c0f', rgb: '101, 163, 13' },
  },
  {
    id: 'mint',
    label: 'Mint',
    dark: { accent: '#6ee7b7', hover: '#a7f3d0', secondary: '#059669', rgb: '110, 231, 183' },
    white: { accent: '#059669', hover: '#047857', secondary: '#047857', rgb: '5, 150, 105' },
  },
] as const
