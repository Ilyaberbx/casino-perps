/**
 * The HL withdraw machine phase. A two-step form → review confirmation gate
 * before a single instant L1 `withdraw3` action: `form → review → signing →
 * sent | error`. `sent` is optimistic-on-`status:ok` (mirrors transfer's
 * `success`); the body shows an arrival track (the bridge takes ~5 min) and the
 * user dismisses with a "Done" button. `error` is non-terminal — it carries a
 * retry and preserves the entered amount + destination + confirm flag.
 */
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'

export type WithdrawPhase = 'form' | 'review' | 'signing' | 'sent' | 'error'

/**
 * Typed withdraw error union. Pre-signing validation failures
 * (`amount-invalid` / `insufficient-balance` / `destination-invalid`) and
 * gateway-mapped failures (`wallet-rejected | deposit-required | rate-limited |
 * network | unknown`). Never thrown — always carried as reducer state.
 */
export type WithdrawError =
  | 'amount-invalid'
  | 'insufficient-balance'
  | 'destination-invalid'
  | 'wallet-rejected'
  | 'deposit-required'
  | 'rate-limited'
  | 'network'
  | 'unknown'

/** Quick-fill percentage chips of the withdrawable balance. */
export type WithdrawPercent = 25 | 50 | 75 | 100

/**
 * Phase-specific slice, discriminated by `phase`. Folding `errorReason` into the
 * union makes an `errorReason` on a non-error phase unrepresentable (mirrors the
 * transfer reducer's discipline).
 */
export type WithdrawPhaseState =
  | { readonly phase: 'form' }
  | { readonly phase: 'review' }
  | { readonly phase: 'signing' }
  | { readonly phase: 'sent' }
  | { readonly phase: 'error'; readonly errorReason: WithdrawError }

/**
 * The full reducer state: the always-present form fields plus the
 * phase-discriminated slice. `destination` defaults to the master address;
 * `isDestinationEdited` flips the moment the user types over the prefill (which
 * arms the irreversible-confirm gate). All form fields survive every transition
 * (preserved across errors), so each reducer arm re-threads them.
 */
export type WithdrawMachineState = {
  /** The controlled amount-input string (preserved across errors). */
  readonly amount: string
  /** Whether the user has touched the amount field yet (gates the invalid hint). */
  readonly amountTouched: boolean
  /** The controlled destination-address string (prefilled to the master address). */
  readonly destination: string
  /** `true` once the user types over the prefilled destination. */
  readonly isDestinationEdited: boolean
  /** `true` once the user confirms the withdrawal is irreversible. */
  readonly confirmedIrreversible: boolean
} & WithdrawPhaseState

/** Reducer actions — each names a transition the hook dispatches. */
export type WithdrawFlowAction =
  | { readonly type: 'AMOUNT_CHANGED'; readonly amount: string }
  | { readonly type: 'DESTINATION_CHANGED'; readonly destination: string }
  | { readonly type: 'CONFIRM_TOGGLED' }
  | { readonly type: 'REVIEWED' }
  | { readonly type: 'BACK' }
  | { readonly type: 'SUBMITTED' }
  /** A wallet-rejected withdraw is non-destructive: errors with the typed reason. */
  | { readonly type: 'FAILED'; readonly reason: WithdrawError }
  | { readonly type: 'SENT' }
  | { readonly type: 'RETRY' }
  | { readonly type: 'RESET'; readonly destination: string }

/**
 * The value exposed to the body by `useWithdrawFlow()`. Read-only state plus the
 * actions the body fires. `amount` / `destination` survive errors.
 */
export interface WithdrawFlowState {
  readonly phase: WithdrawPhase
  /** The controlled amount-input string. */
  readonly amount: string
  /** The controlled destination-address string. */
  readonly destination: string
  /** `true` once the user has typed over the prefilled destination. */
  readonly isDestinationEdited: boolean
  /** `true` once the user confirms the withdrawal is irreversible. */
  readonly confirmedIrreversible: boolean
  /** Withdrawable USDC on the perp account (drives MAX + the "available" line). */
  readonly withdrawable: number
  /** The flat L1 withdrawal fee in USDC. */
  readonly fee: number
  /** The minimum withdrawal amount in USDC. */
  readonly minWithdraw: number
  /** `amount - fee`, floored at 0 (what arrives on Arbitrum). */
  readonly netReceived: number
  /** `true` when `amount` parses to a value in `[min, withdrawable]` with sane precision. */
  readonly isAmountValid: boolean
  /** Human-readable reason when `isAmountValid` is false (and touched), else null. */
  readonly amountInvalidReason: string | null
  /** `true` when `destination` parses to a valid `0x` address. */
  readonly isDestinationValid: boolean
  /** The user's own wallets offered as destination suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as destination suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** `true` when `review()` is permitted (amount + destination valid, confirm gate cleared). */
  readonly canReview: boolean
  /** Present only when `phase === 'error'`. */
  readonly errorReason: WithdrawError | null
  setAmount(next: string): void
  setAmountToMax(): void
  setPercent(percent: WithdrawPercent): void
  setDestination(next: string): void
  toggleConfirmIrreversible(): void
  /** Advance `form → review` (only when `canReview`). */
  review(): void
  /** Return `review → form` with input preserved. */
  back(): void
  /** Sign + submit the withdrawal (from `review`). */
  submit(): void
  /** Clear the error and return to `form` with input preserved. */
  retry(): void
  /** Dismiss the `sent` arrival track and reset the machine. */
  reset(): void
}

/**
 * The provider's context value. Bundles the rich `flow` state (consumed by the
 * body via `useWithdrawFlow()`) with the reactive `isApplicable` (consumed by
 * the thin port `useWithdraw()` and the host gate).
 */
export interface WithdrawFlowContextValue {
  readonly flow: WithdrawFlowState
  readonly isApplicable: boolean
}
