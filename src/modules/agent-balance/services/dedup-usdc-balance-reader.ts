import type { ResultAsync } from 'neverthrow'
import type {
  AgentWalletAddress,
  BalanceReadFailed,
  BaseUsdcBalanceReader,
} from '../agent-balance.types'

/**
 * Wraps a `BaseUsdcBalanceReader` so concurrent reads of the SAME address
 * coalesce onto one in-flight `ResultAsync` — when the Agent Balance tile and
 * the Account Modal wallets section mount together they share one Base
 * `eth_call` instead of each firing their own. Mirrors the server's
 * `RedisAgentBalanceCache` reasoning, on the client (slice OPT-M1).
 *
 * Only the in-flight window is shared: once the promise settles its entry is
 * dropped, so a failure is never retained as a cached success (a later read
 * re-hits the underlying client). Different addresses never coalesce. The
 * wrapper returns the same `BaseUsdcBalanceReader` shape — failures stay
 * `Result` values, no `try/catch`, no throw (error-handling.md).
 */
export function createDedupUsdcBalanceReader(
  inner: BaseUsdcBalanceReader,
): BaseUsdcBalanceReader {
  const inFlight = new Map<
    AgentWalletAddress,
    ResultAsync<number, BalanceReadFailed>
  >()

  const readUsdcBalance = (
    address: AgentWalletAddress,
  ): ResultAsync<number, BalanceReadFailed> => {
    const existing = inFlight.get(address)
    if (existing !== undefined) return existing

    // Drop the entry once the read settles (ok OR err) so the next read starts
    // fresh — the de-dup window is the in-flight period only, never a value
    // cache, so a failure is never reused as a success.
    const pending = inner.readUsdcBalance(address)
    const dropEntry = (): void => {
      inFlight.delete(address)
    }
    pending.match(dropEntry, dropEntry)

    inFlight.set(address, pending)
    return pending
  }

  return { readUsdcBalance }
}
