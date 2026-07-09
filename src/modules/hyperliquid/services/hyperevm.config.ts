import { Result } from 'neverthrow'
import type { Chain } from 'viem'
import { loadHyperliquidConfig, type HyperliquidEnv } from '../hyperliquid.config'
import type { HyperliquidNetwork } from '../hyperliquid.types'
import { defineHyperEvmChain, HYPEREVM_DEFAULT_RPC_URL } from './hyperevm.constants'

/**
 * Env-derived runtime config for the HyperEVM public/wallet clients (NOT a
 * constant — see frontend-architecture.md). `VITE_HYPEREVM_RPC_URL` is an
 * OPTIONAL override for the HyperEVM RPC the EVM→Core flow reads balances /
 * broadcasts on. Unset → the network's public default (`HYPEREVM_DEFAULT_RPC_URL`).
 * Copy of `hyperliquid-deposit.config.ts:resolveArbitrumRpcUrl` (ADR-0069).
 */
export interface HyperEvmRpcEnv {
  readonly VITE_HYPEREVM_RPC_URL?: string
}

export interface ResolvedHyperEvmRpc {
  /** Override URL, or `undefined` to fall back to the public default RPC. */
  readonly url: string | undefined
  /** The rejected raw value when a non-empty override failed validation, else null. */
  readonly invalidRaw: string | null
}

const tryParseUrl = Result.fromThrowable((value: string) => new URL(value))

function isHttpUrl(value: string): boolean {
  const parsed = tryParseUrl(value)
  if (parsed.isErr()) return false
  const isHttpProtocol = parsed.value.protocol === 'http:' || parsed.value.protocol === 'https:'
  return isHttpProtocol
}

/**
 * Resolve the optional `VITE_HYPEREVM_RPC_URL` override. Empty / unset → `undefined`
 * (the caller uses the network's public default). A non-empty but non-http(s)
 * value is rejected and surfaced via `invalidRaw` so the caller can warn once — a
 * misconfigured override never crashes the app and never silently swaps in a
 * broken transport (mirrors `resolveArbitrumRpcUrl`).
 */
export function resolveHyperEvmRpcUrl(env: HyperEvmRpcEnv): ResolvedHyperEvmRpc {
  const raw = env.VITE_HYPEREVM_RPC_URL
  const isMissing = raw === undefined || raw === ''
  if (isMissing) return { url: undefined, invalidRaw: null }
  if (!isHttpUrl(raw)) return { url: undefined, invalidRaw: raw }
  return { url: raw, invalidRaw: null }
}

/**
 * Resolve the viem `Chain` for HyperEVM from the build env — the single
 * env-aware entry point so callers outside the venue (e.g. `account/`'s Privy
 * `supportedChains`) get a chain on the correct network without re-deriving the
 * network/RPC selection. Mirrors `EvmCoreFlowProvider`'s module-init resolution:
 * network defaults to mainnet unless the config parses `testnet`, RPC is the
 * optional override or the public default. ADR-0069 — the EVM⇄Core direction
 * needs HyperEVM in Privy's allowed chains so `switchChain`/`addChain` aren't
 * rejected.
 */
export function resolveHyperEvmChain(env: HyperEvmRpcEnv & HyperliquidEnv): Chain {
  const configResult = loadHyperliquidConfig(env)
  const isTestnet = configResult.isOk() && configResult.value.network === 'testnet'
  const network: HyperliquidNetwork = isTestnet ? 'testnet' : 'mainnet'
  const rpc = resolveHyperEvmRpcUrl(env)
  const rpcUrl = rpc.url ?? HYPEREVM_DEFAULT_RPC_URL[network]
  return defineHyperEvmChain(network, rpcUrl)
}
