import { createPublicClient, http, type WalletClient } from 'viem'
import { base } from 'viem/chains'
import { resolveBaseRpcUrl } from '../agent-balance.config'
import type { AgentWithdrawAuthorizer } from '../agent-balance.types'
import { createAgentWithdrawAuthorizer } from './agent-withdraw-authorizer'
import type {
  BaseReceiptClient,
  BaseTransferWalletClient,
} from './base-usdc-transfer.types'

/**
 * Builds the production Base receipt client (a viem public client pinned to Base
 * over the resolved RPC). Narrowed to `BaseReceiptClient` so the services only
 * ever see the `waitForTransactionReceipt` slice they depend on.
 */
function createBaseReceiptClient(): BaseReceiptClient {
  // `import.meta.env` is not typed with `VITE_BASE_RPC_URL`; widen to the env's
  // structural index shape (mirrors `createBaseUsdcBalanceClient`).
  const url = resolveBaseRpcUrl(import.meta.env as Record<string, string | undefined>)
  return createPublicClient({
    chain: base,
    transport: http(url),
  }) as unknown as BaseReceiptClient
}

/**
 * Bind a connected viem `WalletClient` into the narrow `BaseTransferWalletClient`
 * slice the transfer services consume. The broader viem client satisfies the
 * slice structurally; the cast pins the narrowed view the services use.
 */
function asTransferWalletClient(wallet: WalletClient): BaseTransferWalletClient {
  return wallet as unknown as BaseTransferWalletClient
}

/**
 * Production WITHDRAW authorizer factory. `requestExplicitAuthorization`
 * resolves a FRESH per-action signing client for THIS withdrawal — the explicit
 * approval path (ADR-0046 D-7), never the standing delegated signer. The caller
 * supplies the prompt resolver; this binds the env-backed receipt client.
 */
export function createDefaultAgentWithdrawAuthorizer(
  requestExplicitAuthorization: () => Promise<WalletClient | null>,
): AgentWithdrawAuthorizer {
  return createAgentWithdrawAuthorizer({
    requestExplicitAuthorization: () =>
      requestExplicitAuthorization().then((wallet) =>
        wallet === null ? null : asTransferWalletClient(wallet),
      ),
    publicClient: createBaseReceiptClient(),
  })
}
