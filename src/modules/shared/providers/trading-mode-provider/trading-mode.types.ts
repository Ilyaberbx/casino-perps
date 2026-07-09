import type { ReactNode } from 'react'

/**
 * The global interface-density preference. `pro` shows the full, detailed
 * surfaces; `simple` condenses them. One value, owned by one app-root provider
 * and persisted per browser in localStorage (see CONTEXT.md → "Trading Mode").
 *
 * It drives two distinct reshapes:
 * 1. The portfolio/funds/equity surfaces on **all** devices — read via a plain
 *    `mode === 'simple'` check (the `useIsSimpleMode()` selector).
 * 2. The mobile trade-screen strip, **mobile only** — gated
 *    `isMobile && mode === 'simple'` in `trading/`'s `use-trading-page`.
 */
export type TradingMode = 'pro' | 'simple'

export interface TradingModeContextValue {
  readonly mode: TradingMode
  setMode(mode: TradingMode): void
}

export interface TradingModeProviderProps {
  readonly children: ReactNode
  readonly defaultMode?: TradingMode
}

export type UseTradingModeProviderReturn = TradingModeContextValue
