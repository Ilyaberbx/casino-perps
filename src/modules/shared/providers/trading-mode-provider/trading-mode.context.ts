import { createContext } from 'react'
import type { TradingModeContextValue } from './trading-mode.types'

export const TradingModeContext = createContext<TradingModeContextValue | null>(null)
