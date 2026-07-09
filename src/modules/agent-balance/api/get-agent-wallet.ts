import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import { StatusCodes } from 'http-status-codes'
import type { ApiClient, HttpError } from '@/modules/shared/http'
import type { AgentWalletAddress } from '../agent-balance.types'

/**
 * The server `GET /api/agent-treasury/wallet` body for a REGISTERED Agent Wallet
 * (ADR-0078). `address` is the on-chain Base account the tile reads `balanceOf`
 * on; `walletId` / `userPrivyId` are the server's record detail. There is no
 * `userOwned` flag — the Agent Wallet is user-owned by construction (a
 * client-created embedded wallet), so its export gate is plain session
 * membership, not a server ownership marker.
 */
interface AgentWalletResponse {
  userPrivyId: string
  walletId: string
  address: AgentWalletAddress
}

/**
 * The Agent Wallet read projected for the client: just the Base `address`. A
 * `null` result means the server returned **404** — the Agent Wallet is not yet
 * registered, so the caller should create + register it (ADR-0078).
 */
export interface AgentWalletInfo {
  readonly address: AgentWalletAddress
}

/**
 * Reads the User's Agent Wallet from the server treasury route. Resolves `null`
 * when the server reports **404 not-registered** (the read is genuinely
 * resource-absent; the client treats it as "create + register"); every other
 * failure stays a typed `HttpError`. Thin wrapper over the shared `apiClient`
 * (http.md) — no transport here.
 */
export type GetAgentWallet = () => ResultAsync<AgentWalletInfo | null, HttpError>

export function getAgentWallet(
  client: ApiClient,
): ResultAsync<AgentWalletInfo | null, HttpError> {
  return client
    .get<AgentWalletResponse>('/api/agent-treasury/wallet')
    .map((wallet): AgentWalletInfo | null => ({ address: wallet.address }))
    .orElse((error) => {
      // 404 = the Agent Wallet is not registered yet. Map it to a typed
      // not-registered result (`null`) the hook branches on to create + register;
      // any other HttpError propagates unchanged.
      const isNotRegistered =
        error.kind === 'api' && error.status === StatusCodes.NOT_FOUND
      return isNotRegistered ? okAsync(null) : errAsync(error)
    })
}

/**
 * Address-only projection, retained for the deposit/withdraw sheet content path
 * (which needs only the receive address). `null` when not registered or on a
 * failed read (the sheet `unwrapOr(null)`s it).
 */
export function getAgentWalletAddress(
  client: ApiClient,
): ResultAsync<AgentWalletAddress | null, HttpError> {
  return getAgentWallet(client).map((wallet) => wallet?.address ?? null)
}

/**
 * Binds the shared `apiClient` into a zero-arg `GetAgentWallet` fetcher — the
 * shape the Agent Balance hook injects in production. Tests substitute a fake
 * fetcher returning `okAsync` / `errAsync` instead, so this binding never runs
 * under test.
 */
export function resolveDefaultGetAgentWallet(client: ApiClient): GetAgentWallet {
  return () => getAgentWallet(client)
}
