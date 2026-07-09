import type { CalloutVariant } from './callout.types'

/**
 * Per-variant icon glyph. The icon plus the text label make the variant legible
 * without relying on colour alone (a11y: not colour-only).
 */
export const CALLOUT_ICON: Readonly<Record<CalloutVariant, string>> = {
  warning: '▲',
  error: '✕',
  info: 'i',
} as const

/**
 * Error callouts assert (urgent, money-adjacent failures); warning/info are
 * polite status. Mirrors the Toast primitive's role mapping.
 */
export const CALLOUT_ROLE: Readonly<Record<CalloutVariant, 'alert' | 'status'>> = {
  warning: 'status',
  error: 'alert',
  info: 'status',
} as const
