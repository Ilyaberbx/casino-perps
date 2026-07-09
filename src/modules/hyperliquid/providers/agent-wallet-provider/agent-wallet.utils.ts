import { privateKeyToAccount } from 'viem/accounts'
import type { WalletAddress } from '@/modules/shared/domain'
import type { HyperliquidAgentWallet } from '../../gateway'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { AgentApprovalErrorReason } from './agent-wallet-provider.types'

/**
 * Build the agent signing wallet (`AbstractWallet`) from a private key, lazily,
 * at signing time. `null` key (no approved agent / not yet loaded) ⇒ `null`
 * signer — the trader adapter maps that to a typed `rejected` error.
 *
 * **Security:** the returned viem `LocalAccount` is constructed on demand and
 * intentionally not cached anywhere it can leak. The key passed in lives only in
 * the provider's `agentPrivateKeyRef` (never React state, never logged); this
 * helper is the single point that turns it into a signer and immediately hands
 * it to the gateway's `signL1Action`. Pure derivation (`privateKeyToAccount` is
 * deterministic, no IO), so it is a util, not a service.
 */
export function buildAgentSigningWallet(
  privateKey: `0x${string}` | null,
): HyperliquidAgentWallet | null {
  if (privateKey === null) return null
  return privateKeyToAccount(privateKey)
}

/**
 * Translate a gateway error kind into an agent-approval reason. The mapping is
 * 1:1 except for kinds the agent step cannot produce semantically (e.g.
 * `unknown-address` — the master wallet is always known by the time we call
 * `approveAgent`), which collapse into `unknown`. Exhaustive switch on the
 * gateway-kind union — TypeScript guards completeness via the `never` arm.
 */
export function gatewayKindToAgentReason(
  kind: HyperliquidGatewayError['kind'],
): AgentApprovalErrorReason {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'chain-mismatch':
      return 'chain-mismatch'
    case 'agent-cap-reached':
      // ADR-0036: the reactive cap rejection converges on the same reason as
      // the proactive bootstrap detection — both render the victim picker.
      return 'agent-slots-full'
    case 'name-collision':
      return 'name-collision'
    case 'rate-limited':
      return 'rate-limited'
    case 'deposit-required':
      return 'deposit-required'
    case 'agent-address-reused':
      // ADR-0077: HL rejected a previously-used agent address. Self-healing —
      // the CTA re-approves, and approve() now always mints a fresh key.
      return 'agent-address-reused'
    case 'network':
    case 'invalid-response':
    case 'unknown-address':
    case 'builder-not-funded':
    case 'approval-cap-reached':
      return 'unknown'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

/** Compare two agent addresses case-insensitively (both normalised before compare). */
export function isSameAgentAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export type AgentDesyncResolution =
  | { readonly kind: 'missing' }
  | { readonly kind: 'stale-own-agent' }
  | { readonly kind: 'slots-full' }
  | { readonly kind: 'approved'; readonly privateKey: `0x${string}`; readonly address: WalletAddress }

/**
 * Resolve the agent desync state purely from `(storedKey, hlAgents,
 * expectedAgentName)` — no React, no IO (only the deterministic
 * `privateKeyToAccount` derivation). ADR-0036 D-2 taxonomy:
 *
 * - the local key derives an address matching an HL agent → `approved`
 *   (carrying the key + branded address).
 * - an HL agent carries OUR default name but the key is absent/mismatched
 *   → `stale-own-agent` (one-click same-name replace; the replacement
 *   deregisters the stranded agent atomically — no revoke round-trip).
 * - every named slot is taken by foreign agents and the key matches none
 *   → `slots-full` (the victim picker; approving any new name would be
 *   rejected on the cap).
 * - anything else → `missing` (a free slot exists — foreign agents with a
 *   free slot are NOT a desync; the normal approve simply takes the slot).
 */
export function resolveAgentDesync(
  storedKey: `0x${string}` | null,
  hlAgents: ReadonlyArray<{ address: WalletAddress; name: string }>,
  expectedAgentName: string,
  maxNamedAgents: number,
): AgentDesyncResolution {
  const approved = resolveApprovedFromKey(storedKey, hlAgents)
  if (approved !== null) return approved

  const hasOwnNamedAgent = hlAgents.some((agent) => agent.name === expectedAgentName)
  if (hasOwnNamedAgent) return { kind: 'stale-own-agent' }

  const hasNoFreeSlot = hlAgents.length >= maxNamedAgents
  if (hasNoFreeSlot) return { kind: 'slots-full' }

  return { kind: 'missing' }
}

/** The `approved` arm of {@link resolveAgentDesync}: the stored key derives an address that matches an on-file HL agent. `null` when no key or no match. */
function resolveApprovedFromKey(
  storedKey: `0x${string}` | null,
  hlAgents: ReadonlyArray<{ address: WalletAddress; name: string }>,
): AgentDesyncResolution | null {
  if (storedKey === null) return null

  const account = privateKeyToAccount(storedKey)
  const matchingAgent = hlAgents.find((agent) => isSameAgentAddress(agent.address, account.address))
  if (matchingAgent === undefined) return null

  // The branded `WalletAddress` is a lowercased `0x${string}`; viem's account
  // address is a checksummed `0x${string}` for the same key, so lowercasing it
  // satisfies the brand's invariant.
  const address = account.address.toLowerCase() as WalletAddress
  return { kind: 'approved', privateKey: storedKey, address }
}
