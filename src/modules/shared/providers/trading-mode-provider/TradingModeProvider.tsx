import { useMemo } from 'react'
import { TradingModeContext } from './trading-mode.context'
import { useTradingModeProvider } from './use-trading-mode-provider'
import { DEFAULT_TRADING_MODE } from './trading-mode.constants'
import type { TradingModeContextValue, TradingModeProviderProps } from './trading-mode.types'

/**
 * Owns the persisted global Trading Mode (`pro` / `simple`). Mounted once at the
 * app root (inside `SettingsProvider`) so the Settings → Trading toggle and every
 * mode consumer read the same source: the portfolio/funds/equity surfaces on all
 * devices (`useIsSimpleMode()`), and the mobile-only trade-screen strip in
 * `trading/`'s `use-trading-page`. Optional `defaultMode` for tests.
 */
export function TradingModeProvider({
  children,
  defaultMode = DEFAULT_TRADING_MODE,
}: TradingModeProviderProps) {
  const { mode, setMode } = useTradingModeProvider(defaultMode)

  const value = useMemo<TradingModeContextValue>(() => ({ mode, setMode }), [mode, setMode])

  return <TradingModeContext.Provider value={value}>{children}</TradingModeContext.Provider>
}
