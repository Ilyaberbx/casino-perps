// BuilderFeeProvider status — mirrors AgentWalletProvider's discriminated union
// shape (ADR-0012 / agent-wallet-provider.types.ts). No 'corrupted-key' reason
// because there is no persisted local secret; no 'invalid-name' because the
// approval action has no user-supplied name.
//
// There is no 'bootstrap-failed' reason — a maxBuilderFee info-query failure
// collapses into the real reasons below via gatewayKindToBuilderReason (the same
// mapping the approve path uses). See ADR-0024.

// Widened in slice 6 (#166) — every reason maps 1:1 to a CTA in
// `hyperliquid-onboarding-provider/error-to-cta-mapping.ts`. Bootstrap failure
// (the `queryMaxBuilderFee` info call) collapses into one of these reasons via
// the same SDK-error mapping the approve path uses; `unknown` is the fallback.
export type BuilderFeeApprovalErrorReason =
  | 'wallet-rejected'
  | 'chain-mismatch'
  | 'signing-unavailable'
  | 'builder-not-funded'
  | 'deposit-required'
  | 'approval-cap-reached'
  | 'rate-limited'
  | 'unknown'
  // Legacy alias kept for sibling worktree (#172) compatibility — maps to
  // `unknown` in the CTA mapping. Drop once siblings land.
  | 'approval-failed'

export type BuilderFeeStatus =
  // Initial / post-disconnect state: the bootstrap `queryMaxBuilderFee` read has
  // not yet settled. Distinct from 'missing' (which means "checked — fee not
  // approved, needs onboarding"). The venue keeps itself `bootstrapping` while
  // any step is still 'checking' so an already-onboarded reload never flickers
  // through a transient `incomplete`.
  | 'checking'
  | 'approved'
  | 'missing'
  | 'approving'
  | { kind: 'error'; reason: BuilderFeeApprovalErrorReason }

export class BuilderFeeApprovalError extends Error {
  readonly kind: BuilderFeeApprovalErrorReason
  constructor(kind: BuilderFeeApprovalErrorReason, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'BuilderFeeApprovalError'
  }
}
