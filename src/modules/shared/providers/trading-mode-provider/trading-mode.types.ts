import type { ReactNode } from 'react'

/**
 * The global trade-surface preference. `simple` (the default) is the condensed
 * trade experience: order ticket + position panel, no depth surfaces. `pro`
 * layers the full terminal on top — orderbook, trades tape, and the complete
 * `OrderEntry` with stop / TWAP / TIF. One value, owned by one app-root
 * provider and persisted per browser in localStorage. Selected in
 * Settings → Trading.
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
