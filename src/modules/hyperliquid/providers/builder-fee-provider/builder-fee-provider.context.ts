import { createContext } from 'react'
import type { ResultAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import type { BuilderFeeStatus, BuilderFeeApprovalError } from './builder-fee-provider.types'

export type BuilderFeeState = {
  status: BuilderFeeStatus
  /**
   * Builder addresses the user currently has active fee approvals for,
   * EXCLUDING our own builder (ADR-0036 D-4). `null` until the first
   * cap rejection triggers the `approvedBuilders` fetch — the list exists
   * only to feed the revoke picker; it is not queried at bootstrap.
   */
  approvedBuilders: ReadonlyArray<WalletAddress> | null
  approve: () => ResultAsync<void, BuilderFeeApprovalError>
  /**
   * Free a builder slot, then approve ours — two chained master-wallet
   * signatures: re-approve `victimBuilder` at 0% (Hyperliquid's only
   * slot-freeing mechanism), then run the normal 3.5 bps approval. If the
   * second leg fails the slot is already freed, so a plain retry completes
   * the flow (ADR-0036 D-4).
   */
  replaceBuilder: (victimBuilder: WalletAddress) => ResultAsync<void, BuilderFeeApprovalError>
}

// Context is private to the provider unit — not exported from index.ts.
export const BuilderFeeContext = createContext<BuilderFeeState | null>(null)
