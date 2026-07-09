// D-06: Agent wallet status as discriminated union.
// Errors carry a typed reason; all transitions driven via neverthrow ResultAsync.
// No 'expired' variant — D-03: no expiry clock.

// Widened in slice 6 (#166) — every reason maps 1:1 to a CTA in
// `hyperliquid-onboarding-provider/error-to-cta-mapping.ts`. The
// `agent-exists-no-local-key` + `keystore-write-after-approval` reasons
// land in slice 7.
//
// `approval-failed` is kept as a legacy alias that maps to the same `unknown`
// CTA — sibling worktrees (#172) still construct it in tests; once those land
// and rename, it can be dropped.
// ADR-0036: `agent-cap-reached` was replaced by `agent-slots-full` — both the
// proactive bootstrap detection (3 named agents, none ours) and the reactive
// approve-time cap rejection converge on the one reason whose CTA renders the
// in-house victim picker (no external hand-off).
export type AgentApprovalErrorReason =
  | 'wallet-rejected'
  | 'chain-mismatch'
  | 'signing-unavailable'
  | 'corrupted-key'
  | 'agent-slots-full'
  | 'name-collision'
  | 'rate-limited'
  | 'deposit-required'
  | 'agent-exists-no-local-key'
  | 'keystore-write-after-approval'
  // HL anti-replay (ADR-0077): the minted agent address was already used. Should
  // be unreachable now that approve() always mints a fresh key; kept as a typed,
  // self-healing fallback (its CTA re-approves with a fresh key) instead of 'unknown'.
  | 'agent-address-reused'
  | 'unknown'
  | 'approval-failed'

/**
 * A named agent currently approved on Hyperliquid for the master account —
 * public on-chain data from the `extraAgents` info request (never includes any
 * key material). Feeds the slots-full victim picker (ADR-0036 D-3): `name` is
 * the value the replacement approve must re-use; `validUntil` (ms epoch)
 * renders as the expiry hint.
 */
export interface HyperliquidKnownAgent {
  readonly address: string
  readonly name: string
  readonly validUntil: number
}

export type AgentWalletStatus =
  // Initial / post-disconnect state: the bootstrap query (keystore + queryAgents
  // desync resolution) has not yet settled. Distinct from 'missing' (which means
  // "checked — no usable agent, needs onboarding"). The venue keeps itself
  // `bootstrapping` while any step is still 'checking' so an already-onboarded
  // reload never flickers through a transient `incomplete`.
  | 'checking'
  | 'approved'
  | 'missing'
  | 'approving'
  | { kind: 'error'; reason: AgentApprovalErrorReason }

export class AgentApprovalError extends Error {
  readonly kind: AgentApprovalErrorReason
  constructor(kind: AgentApprovalErrorReason, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'AgentApprovalError'
  }
}
