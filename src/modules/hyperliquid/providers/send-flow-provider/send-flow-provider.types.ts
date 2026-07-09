import type { FlowAssetsStatus } from '../../components/shared-flow/shared-flow.types'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'

/**
 * The HL send machine phase: `form → review → signing → sent | error`. Mirrors
 * the withdraw machine. A send is an HL-internal transfer (usdSend / spotSend) —
 * no L1 bridge, no flat fee — so `sent` is instant (no arrival track, just a ✓).
 * `sent` is optimistic-on-`status:ok`; the user dismisses with "Done". `error`
 * is non-terminal — it carries a retry and preserves the entered amount +
 * destination + selected token.
 */
export type SendPhase = 'form' | 'review' | 'signing' | 'sent' | 'error'

/**
 * Typed send error union. Pre-signing validation failures
 * (`amount-invalid` / `insufficient-balance` / `destination-invalid` /
 * `self-send`) and gateway-mapped failures (`wallet-rejected | deposit-required
 * | rate-limited | network | unknown`). Never thrown — always carried as reducer
 * state. `self-send` is surfaced inline at the destination field, not as a
 * terminal error phase.
 */
export type SendError =
  | 'amount-invalid'
  | 'insufficient-balance'
  | 'destination-invalid'
  | 'self-send'
  | 'wallet-rejected'
  | 'deposit-required'
  | 'rate-limited'
  | 'network'
  | 'unknown'

/** Quick-fill percentage chips of the selected token's available balance. */
export type SendPercent = 25 | 50 | 75 | 100

/**
 * One sendable asset offered in the token picker. `kind` routes the submit:
 * `usd` → `usdSend` (perp USDC); `spot` → `spotSend` with the resolved
 * `"NAME:0xTOKENID"` identifier. `available` is the per-asset sendable balance.
 * `decimals` is the max fractional precision the wire accepts for this asset.
 */
export type SendableToken =
  | {
      readonly key: string
      readonly kind: 'usd'
      readonly symbol: string
      readonly available: number
      readonly decimals: number
    }
  | {
      readonly key: string
      readonly kind: 'spot'
      readonly symbol: string
      readonly available: number
      readonly decimals: number
      /** The Hyperliquid `"NAME:0xTOKENID"` identifier passed to `spotSend`. */
      readonly tokenId: string
    }

/**
 * Phase-specific slice, discriminated by `phase`. Folding `errorReason` into the
 * union makes an `errorReason` on a non-error phase unrepresentable (mirrors the
 * withdraw reducer's discipline).
 */
export type SendPhaseState =
  | { readonly phase: 'form' }
  | { readonly phase: 'review' }
  | { readonly phase: 'signing' }
  | { readonly phase: 'sent' }
  | { readonly phase: 'error'; readonly errorReason: SendError }

/**
 * The full reducer state: the always-present form fields plus the
 * phase-discriminated slice. `destination` starts empty (no prefill — a send
 * goes to an external address). All form fields survive every transition
 * (preserved across errors), so each reducer arm re-threads them.
 */
export type SendMachineState = {
  /** The selected token's stable `key` (`'usd'` or `'spot:<symbol>'`). */
  readonly selectedTokenKey: string
  /** The controlled amount-input string (preserved across errors). */
  readonly amount: string
  /** Whether the user has touched the amount field yet (gates the invalid hint). */
  readonly amountTouched: boolean
  /** The controlled destination-address string (starts empty — no prefill). */
  readonly destination: string
  /** Whether the user has touched the destination field yet. */
  readonly destinationTouched: boolean
} & SendPhaseState

/** Reducer actions — each names a transition the hook dispatches. */
export type SendFlowAction =
  | { readonly type: 'TOKEN_SELECTED'; readonly key: string }
  | { readonly type: 'AMOUNT_CHANGED'; readonly amount: string }
  | { readonly type: 'DESTINATION_CHANGED'; readonly destination: string }
  | { readonly type: 'REVIEWED' }
  | { readonly type: 'BACK' }
  | { readonly type: 'SUBMITTED' }
  | { readonly type: 'FAILED'; readonly reason: SendError }
  | { readonly type: 'SENT' }
  | { readonly type: 'RETRY' }
  | { readonly type: 'RESET'; readonly selectedTokenKey: string }

/**
 * The value exposed to the body by `useSendFlow()`. Read-only state plus the
 * actions the body fires. `amount` / `destination` / selected token survive
 * errors.
 */
export interface SendFlowState {
  readonly phase: SendPhase
  /** Every sendable token (USDC + each resolvable held spot token). */
  readonly tokens: ReadonlyArray<SendableToken>
  /** The currently-selected token (falls back to the first when the key drifts). */
  readonly selectedToken: SendableToken | null
  /** The selected token's stable key. */
  readonly selectedTokenKey: string
  /** The controlled amount-input string. */
  readonly amount: string
  /** The controlled destination-address string. */
  readonly destination: string
  /** The selected token's available balance (drives MAX + the "available" line). */
  readonly available: number
  /** The selected token's display symbol (the amount/summary unit). */
  readonly symbol: string
  /** `true` when `amount` parses to a value in `(0, available]` with sane precision. */
  readonly isAmountValid: boolean
  /** Human-readable reason when `isAmountValid` is false (and touched), else null. */
  readonly amountInvalidReason: string | null
  /** `true` when `destination` parses to a valid `0x` address that is not the user's own. */
  readonly isDestinationValid: boolean
  /** Human-readable reason when the destination is bad / own address (and touched), else null. */
  readonly destinationInvalidReason: string | null
  /** The user's own wallets (minus the Selected Wallet) offered as recipient suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as recipient suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  /** `true` when `review()` is permitted (amount + destination valid, token selected). */
  readonly canReview: boolean
  /** Present only when `phase === 'error'`. */
  readonly errorReason: SendError | null
  /** Token-picker readiness (spot-meta loading / error / empty / ready). */
  readonly assetsStatus: FlowAssetsStatus
  /** Re-run the spot-meta fetch (the picker's `error`-state retry). */
  retryAssets(): void
  selectToken(key: string): void
  setAmount(next: string): void
  setAmountToMax(): void
  setPercent(percent: SendPercent): void
  setDestination(next: string): void
  /** Advance `form → review` (only when `canReview`). */
  review(): void
  /** Return `review → form` with input preserved. */
  back(): void
  /** Sign + submit the send (from `review`). */
  submit(): void
  /** Clear the error and return to `form` with input preserved. */
  retry(): void
  /** Dismiss the `sent` confirmation and reset the machine. */
  reset(): void
}

/**
 * The provider's context value. Bundles the rich `flow` state (consumed by the
 * body via `useSendFlow()`) with the reactive `isApplicable` (consumed by the
 * thin port `useSend()` and the host gate).
 */
export interface SendFlowContextValue {
  readonly flow: SendFlowState
  readonly isApplicable: boolean
}
