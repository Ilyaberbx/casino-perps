import { useContext } from 'react'
import { TradingModeContext } from './trading-mode.context'
import type { TradingModeContextValue } from './trading-mode.types'

export function useTradingMode(): TradingModeContextValue {
  const ctx = useContext(TradingModeContext)
  if (!ctx) {
    throw new Error('useTradingMode must be used inside <TradingModeProvider>')
  }
  return ctx
}
