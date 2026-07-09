import { AgentWalletModal } from '../agent-wallet-modal'

/**
 * The single Agent Wallet surface mounted once in `AppShell`. Both Trading Modes
 * now open the centred `<AgentWalletModal>` — the Pro side sheet was removed so
 * the flow has one surface everywhere. The triggers (single "Manage Agent Wallet"
 * button in Simple, three Deposit / Withdraw / Signing buttons in Pro) all drive
 * this modal via the shared `AgentBalanceSheetProvider` controller.
 */
export function AgentWalletSurface() {
  return <AgentWalletModal />
}
