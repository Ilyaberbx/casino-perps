import { createContext } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import type { HyperliquidAgentWallet } from '../../gateway'
import type {
  AgentWalletStatus,
  AgentApprovalError,
  HyperliquidKnownAgent,
} from './agent-wallet-provider.types'

export type AgentWalletState = {
  status: AgentWalletStatus
  agentAddress: WalletAddress | null
  /**
   * The master account's named agents currently on-file with Hyperliquid
   * (public `extraAgents` data — names/addresses/expiries, never keys).
   * `null` until the bootstrap query resolves; refreshed when an approve is
   * rejected on the agent cap. Feeds the slots-full victim picker
   * (ADR-0036 D-3).
   */
  existingAgents: ReadonlyArray<HyperliquidKnownAgent> | null
  approve: (agentName: string) => ResultAsync<void, AgentApprovalError>
  /**
   * Resolve the agent signing wallet at signing time, or `null` when no
   * approved agent is available. The closure reads the in-memory private key
   * ref and builds the viem `AbstractWallet` lazily — the key never enters
   * React state, the venue, logs, or serialization (see
   * `app/agent-signing-wallet-holder.ts`). The trader adapter maps a `null`
   * result to a typed `rejected` error.
   */
  getSigningWallet: () => HyperliquidAgentWallet | null
}

// Context is private to the provider unit — not exported from index.ts.
export const AgentWalletContext = createContext<AgentWalletState | null>(null)
