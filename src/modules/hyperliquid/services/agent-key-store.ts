import { ok, err, Result } from 'neverthrow'
import { z } from 'zod'
import type { WalletAddress } from '@/modules/shared/domain'

// No logger — private keys must never be logged (logging.md hard rule 1).
// No React imports — this is a pure TS storage service.

export interface AgentKeyStore {
  /** Load the agent private key for the given account (Native) address + network combination.
   *  Returns ok(null) if no key is stored, ok(key) if valid, err('invalid-stored-key') if corrupted. */
  load(accountAddress: WalletAddress, network: string): Result<`0x${string}` | null, 'invalid-stored-key'>
  /**
   * Persist the agent private key scoped by account (Native) address + network.
   * Returns ok(undefined) on success, err('storage-write-failed') if localStorage.setItem throws
   * (e.g. QuotaExceededError or SecurityError). Never throws.
   */
  save(accountAddress: WalletAddress, network: string, privateKey: `0x${string}`): Result<void, 'storage-write-failed'>
  /**
   * Remove the agent private key for a single account (Native) address + network.
   * Returns ok(undefined) on success (including when no key was stored),
   * err('storage-write-failed') if localStorage.removeItem throws. Never throws.
   * Use on a targeted single-account reset.
   */
  clear(accountAddress: WalletAddress, network: string): Result<void, 'storage-write-failed'>
  /**
   * Remove EVERY `hl-agent-key:*` entry from localStorage, regardless of account
   * or network. Returns ok(undefined) on success, err('storage-write-failed') if
   * enumeration/removal throws. Never throws. Use on a full logout/disconnect —
   * defensively clears stale agent keys for every account on a shared browser
   * (SEC-M1), not just the currently-resolved one.
   */
  clearAll(): Result<void, 'storage-write-failed'>
}

const AGENT_KEY_PREFIX = 'hl-agent-key:'

// Validates EIP-style private key: 0x followed by exactly 64 lowercase hex chars (256 bits).
const agentPrivateKeySchema = z.string().regex(/^0x[0-9a-f]{64}$/)

function storageKey(accountAddress: WalletAddress, network: string): string {
  // ADR-0061: scoped per account (Native/embedded wallet) + network — ONE agent
  // key per account, stable across selected-wallet switches; no cross-account or
  // cross-network key reuse. (Supersedes the original "scoped per master" D-01.)
  return `${AGENT_KEY_PREFIX}${accountAddress.toLowerCase()}:${network}`
}

// Wrap localStorage.setItem at the boundary — any quota/security exception maps to the literal.
const safeSetItem = Result.fromThrowable(
  (key: string, value: string) => { localStorage.setItem(key, value) },
  (): 'storage-write-failed' => 'storage-write-failed',
)

// Wrap localStorage.removeItem at the boundary — a SecurityError (privacy mode /
// disabled storage) maps to the literal rather than throwing in feature code.
const safeRemoveItem = Result.fromThrowable(
  (key: string) => { localStorage.removeItem(key) },
  (): 'storage-write-failed' => 'storage-write-failed',
)

// Wrap the enumerate-then-remove sweep at the boundary. Collect every matching
// key first, then remove — `removeItem` re-indexes the store, so mutating while
// iterating by index would skip keys (same pitfall as `clear-privy-storage.ts`).
const safeClearMatching = Result.fromThrowable(
  () => {
    const staleKeys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && key.startsWith(AGENT_KEY_PREFIX)) staleKeys.push(key)
    }
    for (const key of staleKeys) localStorage.removeItem(key)
  },
  (): 'storage-write-failed' => 'storage-write-failed',
)

export function createAgentKeyStore(): AgentKeyStore {
  return {
    load(accountAddress, network) {
      const raw = localStorage.getItem(storageKey(accountAddress, network))
      if (raw === null) return ok(null)
      const parsed = agentPrivateKeySchema.safeParse(raw)
      if (!parsed.success) return err('invalid-stored-key')
      return ok(parsed.data as `0x${string}`)
    },
    save(accountAddress, network, privateKey) {
      return safeSetItem(storageKey(accountAddress, network), privateKey)
    },
    clear(accountAddress, network) {
      return safeRemoveItem(storageKey(accountAddress, network))
    },
    clearAll() {
      return safeClearMatching()
    },
  }
}
