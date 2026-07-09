import type { FC } from 'react'
import type { WalletClient } from 'viem'
import type { AgentBalanceSheetMode } from '../../providers/agent-balance-sheet'
import type {
  AgentWalletAddress,
  AttachAgentSigner,
  DelegationStatusView,
  RemoveAgentSigner,
} from '../../agent-balance.types'
import type { DepositFlowDeps } from '../deposit-flow'
import type { WithdrawFlowDeps } from '../withdraw-flow'
import type { DelegationConsentDeps } from '../delegation-consent'

/** One nav entry: which flow it activates, its label, and its lucide icon. */
export interface AgentWalletTab {
  readonly mode: AgentBalanceSheetMode
  readonly label: string
  readonly Icon: FC<{ size?: number }>
}

export interface AgentWalletModalContent {
  readonly isOpen: boolean
  readonly activeMode: AgentBalanceSheetMode | null
  readonly isMobile: boolean
  readonly tabs: ReadonlyArray<AgentWalletTab>
  readonly depositDeps: DepositFlowDeps
  readonly withdrawDeps: WithdrawFlowDeps
  /** Null when no valid Minara recipient is configured — the Signing tab then shows nothing. */
  readonly delegationDeps: DelegationConsentDeps | null
  onSelectTab(mode: AgentBalanceSheetMode): void
  close(): void
}

export interface AgentWalletNavProps {
  readonly tabs: ReadonlyArray<AgentWalletTab>
  readonly activeMode: AgentBalanceSheetMode | null
  readonly isMobile: boolean
  onSelect(mode: AgentBalanceSheetMode): void
}

/**
 * Collaborators the modal-content hook injects so it is unit-testable without
 * viem / Privy / HTTP. Production fills them from `useAuth()` + the env-backed
 * Base reader / transfer factories.
 */
export interface AgentBalanceSheetContentDeps {
  /** Resolves the Agent Wallet receive address (server treasury read). */
  readonly getAgentWalletAddress?: () => Promise<`0x${string}` | null>
  /** Reads a Base USDC balance (dollars) for any address; `0` on a failed read. */
  readonly readUsdcBalance?: (address: `0x${string}`) => Promise<number>
  /** Resolves the Agent Wallet's own broadcast client (explicit withdraw authorization, ADR-0082). */
  readonly getBroadcastWalletClient?: () => Promise<WalletClient | null>
  /** Switches the Agent Wallet's chain to Base + re-verifies (ADR-0082) — overrides the `useAuth()`-backed default under test. */
  readonly switchToBase?: () => Promise<'switched' | 'rejected' | 'failed'>
  /** The Minara recipient the grant may pay (overrides the env-derived recipient under test). */
  readonly delegationRecipient?: AgentWalletAddress | null
  /** Reads the standing delegation view (server) — overrides the env-backed reader under test. */
  readonly getDelegationStatus?: () => Promise<DelegationStatusView>
  /** Attaches the app signer (Privy seam, ADR-0078) — overrides `useAuth().attachAgentSigner` under test. */
  readonly attachAgentSigner?: AttachAgentSigner
  /** Removes the app signer (Privy seam, ADR-0078) — overrides `useAuth().removeAgentSigner` under test. */
  readonly removeAgentSigner?: RemoveAgentSigner
}

/** The resolved flow deps the modal-content hook returns to the tab bodies. */
export interface AgentBalanceSheetContent {
  readonly mode: AgentBalanceSheetMode | null
  readonly depositDeps: DepositFlowDeps
  readonly withdrawDeps: WithdrawFlowDeps
  /** Null when no valid Minara recipient is configured — the consent surface is then unavailable. */
  readonly delegationDeps: DelegationConsentDeps | null
  close(): void
}
