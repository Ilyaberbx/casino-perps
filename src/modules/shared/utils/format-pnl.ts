// Shared PnL percentage formatting. Promoted out of the account-dock's
// `balances-panel.utils.ts` once a second surface (the shareable PnL card)
// needed the same display rules — both the dock's balance/position rows and the
// card render a signed ROE % and branch on its sign. Pure, no React, no IO.

export type PnlPctSign = 'positive' | 'negative' | 'neutral'

/**
 * Format an ROE / PnL percentage: 2 decimals, a leading `+` for gains, native
 * `-` for losses, and `--` for an unknown (`null`) value. Input is already a
 * percentage (e.g. `31.63` → `+31.63%`), not a ratio.
 */
export function formatPnlPct(pnlPct: number | null): string {
  if (pnlPct === null) return '--'
  const sign = pnlPct > 0 ? '+' : ''
  return `${sign}${pnlPct.toFixed(2)}%`
}

/** Classify a PnL percentage for sign-driven styling (colour, glow). */
export function pnlPctSign(pnlPct: number | null): PnlPctSign {
  if (pnlPct === null) return 'neutral'
  if (pnlPct > 0) return 'positive'
  if (pnlPct < 0) return 'negative'
  return 'neutral'
}
