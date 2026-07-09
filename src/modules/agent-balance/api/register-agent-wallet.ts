import type { ResultAsync } from 'neverthrow'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { AgentWalletInfo } from './get-agent-wallet'
import type { AgentWalletAddress } from '../agent-balance.types'

/**
 * The server `POST /api/agent-treasury/wallet` body (ADR-0078): the
 * client-created Agent Wallet's `address` + Privy server `walletId`. The server
 * verifies the actor owns `address` (`verifyWalletOwnership`) before persisting,
 * and the call is idempotent. Mirrors the server `registerAgentWalletSchema`.
 */
export interface RegisterAgentWalletInput {
  readonly address: string
  readonly walletId: string
}

/** The server register-wallet response — the persisted record. */
interface RegisterAgentWalletResponse {
  userPrivyId: string
  walletId: string
  address: AgentWalletAddress
}

/**
 * Registers a client-created Agent Wallet with the server (ADR-0078:
 * register-not-create). Thin wrapper over the shared `apiClient` (http.md) — no
 * transport here. Returns the persisted Agent Wallet projection so the caller can
 * read its balance immediately.
 */
export function registerAgentWallet(
  client: ApiClient,
  input: RegisterAgentWalletInput,
): ResultAsync<AgentWalletInfo, HttpError> {
  return client
    .post<RegisterAgentWalletResponse>('/api/agent-treasury/wallet', {
      address: input.address,
      walletId: input.walletId,
    })
    .map((wallet) => ({ address: wallet.address }))
}
