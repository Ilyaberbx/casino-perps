import { ArrowDownToLine, ArrowUpFromLine, PenLine } from 'lucide-react'
import type { AgentWalletTab } from './agent-wallet-modal.types'

export const AGENT_WALLET_MODAL_TITLE = 'Manage Agent Wallet'
export const AGENT_WALLET_MODAL_ARIA_LABEL = 'Manage Agent Wallet'

/**
 * Nav-rail tabs for the Simple-mode Agent Wallet modal (#273). Re-hosts the three
 * existing sheet bodies — Deposit, Withdraw, Signing (delegation) — as tabs.
 */
export const AGENT_WALLET_TABS: ReadonlyArray<AgentWalletTab> = [
  { mode: 'deposit', label: 'Deposit', Icon: ArrowDownToLine },
  { mode: 'withdraw', label: 'Withdraw', Icon: ArrowUpFromLine },
  { mode: 'delegation', label: 'Signing', Icon: PenLine },
] as const
