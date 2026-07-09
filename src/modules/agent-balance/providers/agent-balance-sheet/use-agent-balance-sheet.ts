import { useContext } from 'react'
import { AgentBalanceSheetContext } from './agent-balance-sheet.context'
import type { AgentBalanceSheetContextValue } from './agent-balance-sheet.types'

export function useAgentBalanceSheet(): AgentBalanceSheetContextValue {
  const ctx = useContext(AgentBalanceSheetContext)
  if (!ctx) {
    throw new Error(
      'useAgentBalanceSheet must be used inside <AgentBalanceSheetProvider>',
    )
  }
  return ctx
}
