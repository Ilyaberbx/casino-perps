// Env-derived runtime config for the Base RPC the Agent Balance reader uses
// (NOT a constant — see frontend-architecture.md: env-derived values live in
// *.config.ts). `VITE_BASE_RPC_URL` is an OPTIONAL override; unset / invalid
// falls back to the public Base RPC (`PUBLIC_BASE_RPC_URL`). A misconfigured
// override never crashes the app and never silently swaps in a broken transport
// — mirrors `resolveArbitrumRpcUrl` / `resolveLogLevel`'s precedence-with-fallback.

import { Result } from 'neverthrow'
import { PUBLIC_BASE_RPC_URL } from './agent-balance.constants'
import type { AgentWalletAddress } from './agent-balance.types'

export interface BaseRpcEnv {
  readonly VITE_BASE_RPC_URL?: string
}

export interface MinaraRecipientEnv {
  readonly VITE_MINARA_X402_RECIPIENT?: string
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function isEvmAddress(value: string): value is AgentWalletAddress {
  return EVM_ADDRESS_RE.test(value)
}

/**
 * Resolve the configured Minara x402 recipient — the ONLY address the standing
 * delegated signer may pay. `VITE_MINARA_X402_RECIPIENT` must be a 20-byte EVM
 * address; an unset / malformed value resolves `null` (the consent surface then
 * blocks the grant rather than offering an unscoped one). The server is the
 * final allowlist authority and rejects any other recipient.
 */
export function resolveMinaraRecipient(
  env: MinaraRecipientEnv,
): AgentWalletAddress | null {
  const raw = env.VITE_MINARA_X402_RECIPIENT
  const isMissing = raw === undefined || raw === ''
  if (isMissing) return null
  if (!isEvmAddress(raw)) return null
  return raw.toLowerCase() as AgentWalletAddress
}

const tryParseUrl = Result.fromThrowable((value: string) => new URL(value))

function isHttpUrl(value: string): boolean {
  const parsed = tryParseUrl(value)
  if (parsed.isErr()) return false
  const isHttpProtocol =
    parsed.value.protocol === 'http:' || parsed.value.protocol === 'https:'
  return isHttpProtocol
}

/**
 * Resolve the Base RPC URL: the `VITE_BASE_RPC_URL` override when present and a
 * valid http(s) URL, otherwise the public Base RPC fallback.
 */
export function resolveBaseRpcUrl(env: BaseRpcEnv): string {
  const raw = env.VITE_BASE_RPC_URL
  const isMissing = raw === undefined || raw === ''
  if (isMissing) return PUBLIC_BASE_RPC_URL
  if (!isHttpUrl(raw)) return PUBLIC_BASE_RPC_URL
  return raw
}
