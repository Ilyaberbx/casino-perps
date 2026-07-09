import type { ReactNode } from 'react'

/** Which Agent Balance flow the sheet is showing, or `null` when closed. */
export type AgentBalanceSheetMode = 'deposit' | 'withdraw' | 'delegation'

export interface AgentBalanceSheetContextValue {
  /** The open flow, or `null` when the sheet is closed. */
  readonly mode: AgentBalanceSheetMode | null
  /** Open the sheet on the deposit (receive + fund) flow. */
  openDeposit(): void
  /** Open the sheet on the withdraw (explicit per-action) flow. */
  openWithdraw(): void
  /** Open the sheet on the scoped, revocable signing-delegation consent flow. */
  openDelegation(): void
  close(): void
}

export interface AgentBalanceSheetProviderProps {
  readonly children: ReactNode
  readonly defaultMode?: AgentBalanceSheetMode | null
}
