import type { HyperliquidAgentWallet } from '@/modules/hyperliquid'

/**
 * Module-scope holder for the agent **signing-wallet getter** — the bridge that
 * lets the non-React Hyperliquid venue factory obtain an agent `AbstractWallet`
 * at signing time without the venue capturing per-render React state. Mirrors
 * `wallet-address-holder.ts`: a value owned by a React provider, written from an
 * effect, read by the venue through a stable getter passed at construction.
 *
 * **Security (the whole reason this is a getter, not a value):** the holder
 * NEVER stores the agent private key. It stores a getter closure that the
 * `AgentWalletProvider` builds; that closure reads the key from the keystore and
 * builds the viem `AbstractWallet` **lazily, per call**, at signing time. The
 * key therefore never enters React state, never enters this holder, never the
 * venue, is never serialized, and is never logged. When no approved agent /
 * master wallet is available the getter returns `null`, and the trader adapter
 * turns that into a typed `placeOrder` `rejected` error — it never throws.
 *
 * The getter is intentionally untyped beyond `() => HyperliquidAgentWallet |
 * null`; the holder has no visibility into the key material it transitively
 * resolves. `null` getter (no provider mounted yet) ⇒ "no signer available".
 */
let getAgentSigningWallet: (() => HyperliquidAgentWallet | null) | null = null

export function setAgentSigningWalletGetter(
  getter: (() => HyperliquidAgentWallet | null) | null,
): void {
  getAgentSigningWallet = getter
}

export function getCurrentAgentSigningWallet(): HyperliquidAgentWallet | null {
  if (getAgentSigningWallet === null) return null
  return getAgentSigningWallet()
}
