import { useCallback, useMemo, useState } from 'react'
import { AgentBalanceSheetContext } from './agent-balance-sheet.context'
import type {
  AgentBalanceSheetContextValue,
  AgentBalanceSheetMode,
  AgentBalanceSheetProviderProps,
} from './agent-balance-sheet.types'

/**
 * Owns the `{ mode, openDeposit, openWithdraw, close }` controller for the Agent
 * Balance sheet. `mode` is the single source of truth for which flow (if any) is
 * showing — `null` is closed. Stateless beyond that flag: opening logic lives at
 * the consumers (the tile's `<AgentBalanceActions>` triggers). Structural mirror
 * of `shared/providers/deposit-sheet-provider`, widened from a boolean to a
 * deposit/withdraw discriminator so one sheet hosts both flows.
 */
export function AgentBalanceSheetProvider({
  children,
  defaultMode = null,
}: AgentBalanceSheetProviderProps) {
  const [mode, setMode] = useState<AgentBalanceSheetMode | null>(defaultMode)
  const openDeposit = useCallback(() => setMode('deposit'), [])
  const openWithdraw = useCallback(() => setMode('withdraw'), [])
  const openDelegation = useCallback(() => setMode('delegation'), [])
  const close = useCallback(() => setMode(null), [])
  const value = useMemo<AgentBalanceSheetContextValue>(
    () => ({ mode, openDeposit, openWithdraw, openDelegation, close }),
    [mode, openDeposit, openWithdraw, openDelegation, close],
  )
  return (
    <AgentBalanceSheetContext.Provider value={value}>
      {children}
    </AgentBalanceSheetContext.Provider>
  )
}
