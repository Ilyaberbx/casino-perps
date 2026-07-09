import { useIsSimpleMode } from '@/modules/shared/providers/trading-mode-provider'
import { useAgentBalanceSheet } from '../../providers/agent-balance-sheet'
import type { AgentBalanceActionsViewModel } from './agent-balance-actions.types'

/**
 * Smart hook for `<AgentBalanceActions>`. Reads the Agent Wallet modal
 * controller and the global Trading Mode. In Pro it exposes the three open
 * handlers (Deposit / Withdraw / Signing); in Simple the dumb body collapses to
 * a single "Manage Agent Wallet" button that opens the modal on its first flow
 * (#273). No state of its own — the open/close machine lives in the provider so
 * the tile actions and the modal share one source of truth.
 */
export function useAgentBalanceActions(): AgentBalanceActionsViewModel {
  const { openDeposit, openWithdraw, openDelegation } = useAgentBalanceSheet()
  const isSimple = useIsSimpleMode()
  return { isSimple, openDeposit, openWithdraw, openDelegation }
}
