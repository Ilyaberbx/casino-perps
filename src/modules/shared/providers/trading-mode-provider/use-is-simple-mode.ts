import { useTradingMode } from './use-trading-mode'

/**
 * Thin selector over {@link useTradingMode} for the **density** half of Trading
 * Mode: `true` when the global mode is `simple`. This is reshape #1 from
 * CONTEXT.md's "Trading Mode" entry — the portfolio/funds/equity surfaces
 * condense on **all** devices via a plain `mode === 'simple'` check, with no
 * device gate.
 *
 * It is **not** the mobile trade-screen gate (reshape #2), which stays
 * `isMobile && mode === 'simple'` and lives in `trading/`'s `use-trading-page`.
 */
export function useIsSimpleMode(): boolean {
  return useTradingMode().mode === 'simple'
}
