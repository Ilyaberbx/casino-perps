import { Result } from 'neverthrow'

/**
 * Env-derived runtime config for the deposit public client (NOT a constant — see
 * frontend-architecture.md). `VITE_ARBITRUM_RPC_URL` is an OPTIONAL override for
 * the Arbitrum One RPC the deposit flow reads balances / waits for receipts on.
 * Unset → viem's default public RPC (rate-limited; the reason a `balanceOf` read
 * can fail with no obvious cause — the diagnose thread behind this knob).
 */
export interface DepositRpcEnv {
  readonly VITE_ARBITRUM_RPC_URL?: string
}

export interface ResolvedArbitrumRpc {
  /** Override URL, or `undefined` to fall back to viem's default public RPC. */
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
 * Resolve the optional `VITE_ARBITRUM_RPC_URL` override. Empty / unset → `undefined`
 * (viem uses the chain's default public RPC). A non-empty but non-http(s) value is
 * rejected and surfaced via `invalidRaw` so the caller can warn once — a
 * misconfigured override never crashes the app and never silently swaps in a
 * broken transport (mirrors `resolveLogLevel`'s precedence-with-fallback).
 */
export function resolveArbitrumRpcUrl(env: DepositRpcEnv): ResolvedArbitrumRpc {
  const raw = env.VITE_ARBITRUM_RPC_URL
  const isMissing = raw === undefined || raw === ''
  if (isMissing) return { url: undefined, invalidRaw: null }
  if (!isHttpUrl(raw)) return { url: undefined, invalidRaw: raw }
  return { url: raw, invalidRaw: null }
}
