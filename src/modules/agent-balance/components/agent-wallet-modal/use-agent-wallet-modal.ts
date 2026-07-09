import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useAgentBalanceSheet } from '../../providers/agent-balance-sheet'
import type { AgentBalanceSheetMode } from '../../providers/agent-balance-sheet'
import { useAgentBalanceSheetContent } from './use-agent-balance-sheet-content'
import { AGENT_WALLET_TABS } from './agent-wallet-modal.constants'
import type { AgentWalletModalContent } from './agent-wallet-modal.types'

/**
 * Smart hook for `<AgentWalletModal>` (#273, now the only Agent Wallet surface).
 * Composes the colocated content hook (`useAgentBalanceSheetContent`) so the
 * Deposit / Withdraw / Signing flows keep their resolved deps verbatim — no
 * flow-logic rewrite. The provider `mode` doubles as both the open flag and the
 * active tab; selecting a tab re-points it via the provider's open* handlers, and
 * `close` dismisses the modal.
 */
export function useAgentWalletModal(): AgentWalletModalContent {
  const { openDeposit, openWithdraw, openDelegation } = useAgentBalanceSheet()
  const { mode, depositDeps, withdrawDeps, delegationDeps, close } =
    useAgentBalanceSheetContent()
  const isMobile = useIsMobile()

  const onSelectTab = (next: AgentBalanceSheetMode) => {
    if (next === 'deposit') return openDeposit()
    if (next === 'withdraw') return openWithdraw()
    openDelegation()
  }

  return {
    isOpen: mode !== null,
    activeMode: mode,
    isMobile,
    tabs: AGENT_WALLET_TABS,
    depositDeps,
    withdrawDeps,
    delegationDeps,
    onSelectTab,
    close,
  }
}
