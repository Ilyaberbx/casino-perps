// DepositProvider status — mirrors BuilderFeeProvider's discriminated union shape.
// No 'wallet-rejected' / 'chain-mismatch' / 'signing-unavailable' reasons because
// the deposit step has no signature (D-7, Pitfall 4 — read-only ledger query).
//
// 'deposit-required' is included so a genuine query failure can render the
// external-link CTA via Plan 04's mapDepositErrorReasonToStatus.
// The never-deposited path (ledger history with no 'deposit' delta) is treated
// as 'needs-deposit' at the provider layer; only genuine query failures land in
// the error status here.
//
// LOW-1: the grouped-'unknown' arm in the gatewayKindToDepositReason switch is
// intentional — only 'deposit-required' and 'rate-limited' get named arms;
// every other gateway kind (wallet-rejected, chain-mismatch, etc.) collapses to
// 'unknown' because the deposit query (userNonFundingLedgerUpdates) is read-only
// and cannot produce those signing-path errors.

export type DepositErrorReason = 'deposit-required' | 'rate-limited' | 'unknown'

export type DepositStatus =
  | 'checking'
  | 'funded'
  | 'needs-deposit'
  | { kind: 'error'; reason: DepositErrorReason }

export class DepositError extends Error {
  readonly kind: DepositErrorReason
  constructor(kind: DepositErrorReason, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'DepositError'
  }
}
