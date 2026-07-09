import { createContext } from 'react'
import type { AgentBalanceSheetContextValue } from './agent-balance-sheet.types'

export const AgentBalanceSheetContext =
  createContext<AgentBalanceSheetContextValue | null>(null)
