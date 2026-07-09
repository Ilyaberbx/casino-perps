import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { resolveBaseRpcUrl } from '../agent-balance.config'
import type { UsdcBalanceClient } from '../agent-balance.types'
import { createBaseUsdcBalanceReader } from './base-usdc-balance-reader'
import { createDedupUsdcBalanceReader } from './dedup-usdc-balance-reader'
import type { BaseUsdcBalanceReader } from '../agent-balance.types'

/**
 * Builds the production Base `UsdcBalanceClient` from env config: a viem public
 * client pinned to Base (chainId 8453) over the resolved `VITE_BASE_RPC_URL`
 * (public fallback). Narrowed to `UsdcBalanceClient` at the boundary so the
 * reader only ever sees the `readContract` slice it depends on.
 */
export function createBaseUsdcBalanceClient(): UsdcBalanceClient {
  // `import.meta.env` is not typed with `VITE_BASE_RPC_URL`; widen to the
  // env's structural index shape so the resolver reads the optional override
  // (mirrors how `DepositFlowProvider` passes env into `resolveArbitrumRpcUrl`).
  const url = resolveBaseRpcUrl(
    import.meta.env as Record<string, string | undefined>,
  )
  return createPublicClient({
    chain: base,
    transport: http(url),
  }) as unknown as UsdcBalanceClient
}

/**
 * The lazily-created, module-level singleton default reader. Built once on the
 * first `createDefaultBaseUsdcBalanceReader()` call and shared by all three
 * `useAgentBalance` surfaces (tile, account-modal wallets, perp-suggestion
 * sheet) plus the sheet content hook — one viem public client instead of a
 * fresh one per mount (slice OPT-M1).
 */
let cachedDefaultReader: BaseUsdcBalanceReader | null = null

/**
 * Convenience: the default env-backed reader the tile uses in production.
 * Memoized to a module-level singleton (one viem client across every surface)
 * and wrapped so concurrent reads of the same address coalesce onto one
 * `eth_call`. The `createBaseUsdcBalanceClient` / `createBaseUsdcBalanceReader`
 * factories stay un-memoized — only this convenience accessor is shared.
 */
export function createDefaultBaseUsdcBalanceReader(): BaseUsdcBalanceReader {
  if (cachedDefaultReader !== null) return cachedDefaultReader
  cachedDefaultReader = createDedupUsdcBalanceReader(
    createBaseUsdcBalanceReader({ client: createBaseUsdcBalanceClient() }),
  )
  return cachedDefaultReader
}
