import type { TransferFromAccount } from '@/modules/shared/providers/transfer-sheet-provider'

/**
 * The HL transfer machine phase. Far simpler than deposit — a single instant L1
 * action, no chain switch, no settlement polling: `idle → signing → success |
 * error`. `success` is optimistic-on-`status:ok` (ADR-0033 D-2); the body shows
 * a toast and the host closes. `error` is non-terminal — it carries a retry and
 * preserves the entered amount + direction.
 */
export type TransferPhase = 'idle' | 'signing' | 'success' | 'error'

/** Which sub-account a side of the transfer points at. */
export type TransferAccount = TransferFromAccount

/**
 * Typed transfer error union (ADR-0033 / spec). Pre-signing validation failures
 * (`amount-invalid` / `insufficient-balance`) and gateway-mapped failures
 * (`wallet-rejected | deposit-required | rate-limited | network | unknown`).
 * Never thrown — always carried as `err` / reducer state.
 */
export type TransferError =
  | 'amount-invalid'
  | 'insufficient-balance'
  | 'wallet-rejected'
  | 'deposit-required'
  | 'rate-limited'
  | 'network'
  | 'unknown'

/**
 * Phase-specific slice, discriminated by `phase`. Folding `errorReason` into the
 * union makes an `errorReason` on a non-error phase unrepresentable (mirrors the
 * deposit reducer's discipline).
 */
export type TransferPhaseState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'signing' }
  | { readonly phase: 'success' }
  | { readonly phase: 'error'; readonly errorReason: TransferError }

/**
 * The full reducer state: the always-present direction + amount fields plus the
 * phase-discriminated slice. `from` defaults to `'spot'` (Spot→Perp), or the
 * sheet prefill's `from` when opened from a per-row button.
 */
export type TransferMachineState = {
  /** The account funds move *from*. `to` is the opposite (USDC, two accounts). */
  readonly from: TransferAccount
  /** The controlled amount-input string (preserved across errors). */
  readonly amount: string
  /** Whether the user has touched the amount field yet (gates the invalid hint). */
  readonly amountTouched: boolean
} & TransferPhaseState

/** Reducer actions — each names a transition the hook dispatches. */
export type TransferFlowAction =
  | { readonly type: 'AMOUNT_CHANGED'; readonly amount: string }
  | { readonly type: 'DIRECTION_SET'; readonly from: TransferAccount }
  | { readonly type: 'SWAPPED' }
  | { readonly type: 'SUBMITTED' }
  /** A wallet-rejected transfer is non-destructive: errors with the typed reason. */
  | { readonly type: 'FAILED'; readonly reason: TransferError }
  | { readonly type: 'SUCCEEDED' }
  | { readonly type: 'RETRY' }

/**
 * The value exposed to the body by `useTransferFlow()`. Read-only state plus the
 * actions the body fires. `amount` / `from` survive errors.
 */
export interface TransferFlowState {
  readonly phase: TransferPhase
  /** The account funds move from. */
  readonly from: TransferAccount
  /** The account funds move to (the opposite of `from`). */
  readonly to: TransferAccount
  /** The controlled amount-input string. */
  readonly amount: string
  /** Available USDC in the `from` account (drives MAX + the "X available" line). */
  readonly available: number
  /** `true` when `amount` parses to a value in `(0, available]` with sane precision. */
  readonly isAmountValid: boolean
  /** Human-readable reason when `isAmountValid` is false (and touched), else null. */
  readonly amountInvalidReason: string | null
  /** Present only when `phase === 'error'`. */
  readonly errorReason: TransferError | null
  setAmount(next: string): void
  setAmountToMax(): void
  /** Flip the From/To direction. */
  swap(): void
  /** Sign + submit the transfer (from `idle` / after a retry). */
  submit(): void
  /** Clear the error and return to `idle` with input preserved. */
  retry(): void
}

/**
 * The provider's context value. Bundles the rich `flow` state (consumed by the
 * body via `useTransferFlow()`) with the reactive `isApplicable` (consumed by
 * the thin port `useTransfer()` and the host gate). `isApplicable` is derived
 * from the venue's `accountMode` capability, so it lives here rather than on the
 * lean `TransferFlowState` the body reads.
 */
export interface TransferFlowContextValue {
  readonly flow: TransferFlowState
  readonly isApplicable: boolean
}
