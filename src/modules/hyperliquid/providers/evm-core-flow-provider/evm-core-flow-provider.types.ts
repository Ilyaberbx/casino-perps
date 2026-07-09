import type { FlowAssetsStatus } from '../../components/shared-flow/shared-flow.types'

/**
 * The two directions of an EVM⇄Core move. `core-to-evm` sends an L1 spot token
 * to its system address (credits the user's HyperEVM address) — a master-signed
 * `spotSend`, the slice-1 direction. `evm-to-core` is the on-chain HyperEVM
 * transfer back (slice 2); until then the toggle offers it disabled.
 */
export type EvmCoreDirection = 'core-to-evm' | 'evm-to-core'

/**
 * The HL EVM⇄Core machine phase: `form → review → signing → sent | error`.
 * Mirrors the send machine. Core→EVM stays an HL-internal action (`spotSend` to
 * a system address) so `sent` is optimistic-on-`status:ok` (no arrival track,
 * just a ✓); the user dismisses with "Done". `error` is non-terminal — it
 * carries a retry and preserves the entered amount + selected token + direction.
 */
export type EvmCorePhase = 'form' | 'review' | 'signing' | 'sent' | 'error'

/**
 * Typed EVM⇄Core error union. Pre-signing validation failures (`amount-invalid` /
 * `insufficient-balance`), Core→EVM gateway-mapped failures (`wallet-rejected |
 * deposit-required | rate-limited | network`), and the EVM→Core on-chain failures
 * (`chain-switch-failed | transfer-failed`). Never thrown — always carried as
 * reducer state.
 */
export type EvmCoreError =
  | 'amount-invalid'
  | 'insufficient-balance'
  | 'wallet-rejected'
  | 'deposit-required'
  | 'rate-limited'
  | 'network'
  | 'chain-switch-failed'
  | 'transfer-failed'
  | 'unknown'

/**
 * The EVM-side preflight status for the `evm-to-core` direction (only meaningful
 * then). `checking` while the wallet/chain/gas/balance reads run; `wrong-chain`
 * when the wallet isn't on HyperEVM (offer a switch); `no-gas` when the wallet
 * holds 0 native HYPE (block Sign); `ready` once the form can proceed. Mirrors the
 * Deposit preflight branch shape (ADR-0069).
 */
export type EvmPreflightStatus = 'checking' | 'wrong-chain' | 'no-gas' | 'ready'

/** Quick-fill percentage chips of the selected token's available balance. */
export type EvmCorePercent = 25 | 50 | 75 | 100

/**
 * One movable token offered in the picker. Every EVM⇄Core token routes through
 * its **system address** (HYPE → the special `0x2222…2222`, others → the
 * index-derived address), so unlike `SendableToken` there is no usd/spot split.
 * `available` is the HyperCore (L1 spot) balance. `decimals` is the Core-side
 * amount precision (`weiDecimals`). The EVM-side fields (`evmExtraWeiDecimals`,
 * `evmAddress`) are carried for the slice-2 EVM→Core on-chain path; `evmAddress`
 * is `null` for native HYPE.
 */
export interface EvmCoreToken {
  /** The stable picker key (`evm-core:<symbol>`). */
  readonly key: string
  /** The canonical display symbol (the join key for a balance row). */
  readonly symbol: string
  /** The RAW HL token name (the `NAME` in `NAME:0xTOKENID` + the system-address join). */
  readonly name: string
  /** The HL token index — derives the system address for non-HYPE tokens. */
  readonly index: number
  /** The Hyperliquid `"NAME:0xTOKENID"` identifier passed to `spotSend`. */
  readonly tokenId: string
  /** The HyperCore (L1 spot) available balance. */
  readonly available: number
  /** The Core-side amount precision cap (`weiDecimals`). */
  readonly decimals: number
  /** `true` for HYPE — the native gas token with the special `0x2222…2222` system address. */
  readonly isHype: boolean
  /** EVM extra wei decimals (`evm_extra_wei_decimals`) — slice-2 decimals scaling. */
  readonly evmExtraWeiDecimals: number
  /** The token's HyperEVM ERC20 contract — `null` for native HYPE. Slice-2 EVM→Core. */
  readonly evmAddress: `0x${string}` | null
}

/**
 * Phase-specific slice, discriminated by `phase`. Folding `errorReason` into the
 * union makes an `errorReason` on a non-error phase unrepresentable (mirrors the
 * send reducer's discipline).
 */
export type EvmCorePhaseState =
  | { readonly phase: 'form' }
  | { readonly phase: 'review' }
  | { readonly phase: 'signing' }
  | { readonly phase: 'sent'; readonly transactionHash: `0x${string}` | null }
  | { readonly phase: 'error'; readonly errorReason: EvmCoreError }

/**
 * The full reducer state: the always-present form fields plus the
 * phase-discriminated slice. All form fields survive every transition (preserved
 * across errors), so each reducer arm re-threads them. Switching the direction or
 * the token resets the amount.
 */
export type EvmCoreMachineState = {
  /** The active move direction. */
  readonly direction: EvmCoreDirection
  /** The selected token's stable `key` (`evm-core:<symbol>`). */
  readonly selectedTokenKey: string
  /** The controlled amount-input string (preserved across errors). */
  readonly amount: string
  /** Whether the user has touched the amount field yet (gates the invalid hint). */
  readonly amountTouched: boolean
} & EvmCorePhaseState

/** Reducer actions — each names a transition the hook dispatches. */
export type EvmCoreFlowAction =
  | { readonly type: 'DIRECTION_CHANGED'; readonly direction: EvmCoreDirection }
  | { readonly type: 'TOKEN_SELECTED'; readonly key: string }
  | { readonly type: 'AMOUNT_CHANGED'; readonly amount: string }
  | { readonly type: 'REVIEWED' }
  | { readonly type: 'BACK' }
  | { readonly type: 'SUBMITTED' }
  | { readonly type: 'FAILED'; readonly reason: EvmCoreError }
  | { readonly type: 'SENT'; readonly transactionHash: `0x${string}` | null }
  | { readonly type: 'RETRY' }
  | { readonly type: 'RESET'; readonly selectedTokenKey: string }

/**
 * The value exposed to the body by `useEvmCoreFlow()`. Read-only state plus the
 * actions the body fires. `amount` / selected token / direction survive errors.
 */
export interface EvmCoreFlowState {
  readonly phase: EvmCorePhase
  /** The active move direction (`core-to-evm` is the only live one in slice 1). */
  readonly direction: EvmCoreDirection
  /** Every movable (EVM-linked) token held on HyperCore. */
  readonly tokens: ReadonlyArray<EvmCoreToken>
  /** The currently-selected token (falls back to the first when the key drifts). */
  readonly selectedToken: EvmCoreToken | null
  /** The selected token's stable key. */
  readonly selectedTokenKey: string
  /** The controlled amount-input string. */
  readonly amount: string
  /** The selected token's available balance (drives MAX + the "available" line). */
  readonly available: number
  /** The selected token's display symbol (the amount/summary unit). */
  readonly symbol: string
  /** `true` when `amount` parses to a value in `(0, available]` with sane precision. */
  readonly isAmountValid: boolean
  /** Human-readable reason when `isAmountValid` is false (and touched), else null. */
  readonly amountInvalidReason: string | null
  /** `true` when `review()` is permitted (amount valid, token selected, EVM side ready). */
  readonly canReview: boolean
  /** Present only when `phase === 'error'`. */
  readonly errorReason: EvmCoreError | null
  /** The EVM-side preflight status — only meaningful for the `evm-to-core` direction. */
  readonly evmPreflight: EvmPreflightStatus
  /** Token-picker readiness (spot-meta loading / error / empty / ready). */
  readonly assetsStatus: FlowAssetsStatus
  /** The mined HyperEVM tx hash, present on `sent` for `evm-to-core` (else null). */
  readonly transactionHash: `0x${string}` | null
  /** Explorer URL for `transactionHash`, or null when there is no on-chain tx. */
  readonly explorerTxUrl: string | null
  setDirection(direction: EvmCoreDirection): void
  /** Re-run the spot-meta fetch (the picker's `error`-state retry). */
  retryAssets(): void
  /** Switch the wallet to HyperEVM (from the `wrong-chain` preflight state). */
  switchChain(): void
  selectToken(key: string): void
  setAmount(next: string): void
  setAmountToMax(): void
  setPercent(percent: EvmCorePercent): void
  /** Advance `form → review` (only when `canReview`). */
  review(): void
  /** Return `review → form` with input preserved. */
  back(): void
  /** Sign + submit the move (from `review`). */
  submit(): void
  /** Clear the error and return to `form` with input preserved. */
  retry(): void
  /** Dismiss the `sent` confirmation and reset the machine. */
  reset(): void
}

/**
 * The provider's context value. Bundles the rich `flow` state (consumed by the
 * body via `useEvmCoreFlow()`) with the reactive `isApplicable` (consumed by the
 * thin port `useEvmCore()`).
 */
export interface EvmCoreFlowContextValue {
  readonly flow: EvmCoreFlowState
  readonly isApplicable: boolean
}
