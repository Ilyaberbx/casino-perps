/**
 * Deterministic background color ramp for the colored-letter placeholder.
 *
 * Index = Math.abs(letter.toUpperCase().charCodeAt(0) - 65) % RAMP.length
 *
 * All values are CSS variable strings so the placeholder recolors correctly
 * in both [data-theme='dark'] and [data-theme='white'] automatically.
 * Note: var(--accent-secondary) is defined in index.css but NOT in tokens/index.ts;
 * the CSS variable string is used directly here.
 */
export const LETTER_BG_RAMP: readonly string[] = [
  'var(--accent)',
  'var(--accent-secondary)',
  'var(--accent-hover)',
  'var(--border-strong)',
  'var(--surface-elevated)',
] as const
