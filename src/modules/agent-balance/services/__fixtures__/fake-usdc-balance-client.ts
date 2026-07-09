import type {
  AgentWalletAddress,
  UsdcBalanceClient,
} from '../../agent-balance.types'

/**
 * Minimal fake of the viem `readContract` boundary used by the
 * base-usdc-balance-reader tests. We resolve a fixed raw `bigint` (6-decimal
 * USDC units) or reject with a supplied cause — never mock the whole viem
 * client (testing.md: fake at the boundary, not the SDK).
 */
export function buildFakeUsdcBalanceClient(args: {
  rawBalance?: bigint
  reject?: unknown
}): UsdcBalanceClient {
  return {
    readContract: () => {
      if ('reject' in args && args.reject !== undefined) {
        return Promise.reject(args.reject)
      }
      return Promise.resolve(args.rawBalance ?? 0n)
    },
  }
}

/** A `UsdcBalanceClient` fake that records `readContract` invocations. */
export interface CountingUsdcBalanceClient extends UsdcBalanceClient {
  /** Total number of `readContract` calls made so far. */
  callCount(): number
  /** Number of `readContract` calls made for a specific address. */
  callCountFor(address: AgentWalletAddress): number
  /** Resolve every in-flight (deferred) `readContract` promise. */
  resolveAll(): void
}

/**
 * A counting fake whose `readContract` stays pending until `resolveAll()` is
 * called, so a test can fire two concurrent reads, assert the underlying call
 * count, then release them deterministically (no fake timers). The resolved raw
 * balance is per-address (default `0n`).
 */
export function buildCountingUsdcBalanceClient(args?: {
  rawBalanceByAddress?: Readonly<Record<string, bigint>>
}): CountingUsdcBalanceClient {
  const callsByAddress = new Map<AgentWalletAddress, number>()
  const pending: Array<() => void> = []
  let total = 0

  return {
    readContract: (input) => {
      total += 1
      callsByAddress.set(
        input.args[0],
        (callsByAddress.get(input.args[0]) ?? 0) + 1,
      )
      const raw = args?.rawBalanceByAddress?.[input.args[0]] ?? 0n
      return new Promise<bigint>((resolve) => {
        pending.push(() => resolve(raw))
      })
    },
    callCount: () => total,
    callCountFor: (address) => callsByAddress.get(address) ?? 0,
    resolveAll: () => {
      const toResolve = pending.splice(0)
      toResolve.forEach((resolve) => resolve())
    },
  }
}
