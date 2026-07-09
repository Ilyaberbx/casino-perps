/**
 * The rich, HL-specific deposit machine state. INTERNAL to the venue body — the
 * generic host never sees it (it consumes only the thin `DepositState` from the
 * port's `useDeposit()`). The body reads this via `useDepositFlow()`.
 *
 * Machine: `checking → needs-funding | wrong-chain | no-gas | ready → signing →
 * sent → credited`. Errors (`wallet-rejected | chain-switch-failed |
 * transfer-failed | insufficient-balance | unknown`) are non-terminal: each
 * carries a retry and never loses the entered amount.
 */
export type DepositPhase =
  | 'checking'
  | 'needs-funding'
  | 'wrong-chain'
  | 'no-gas'
  | 'ready'
  | 'signing'
  | 'sent'
  | 'credited'
  | 'error'

/**
 * The phases `resolveBranchPhase` (and so `PREFLIGHT_RESOLVED`) can land on —
 * the data-free branches reachable directly from `checking`. Excludes the
 * phases that carry their own data (`sent`/`credited`/`error`) and the
 * transient `signing`.
 */
export type DepositBranchPhase = 'needs-funding' | 'wrong-chain' | 'no-gas' | 'ready'

export type DepositFlowErrorReason =
  | 'wallet-rejected'
  | 'chain-switch-failed'
  | 'transfer-failed'
  | 'insufficient-balance'
  | 'unknown'

/**
 * The value exposed to the body by `useDepositFlow()`. Read-only state plus the
 * three actions the body can fire. `amount` is the controlled USDC amount
 * string; it is preserved across `wallet-rejected` and every error.
 */
/**
 * Phase-specific slice of the machine state, discriminated by `phase`. Folding
 * `errorReason` / `transactionHash` into the union makes illegal combinations
 * (e.g. an `errorReason` set while `phase === 'ready'`, or a `transactionHash`
 * before broadcast) unrepresentable, so no manual `setErrorReason(null)` resets
 * are needed (WR-DF-01/02).
 */
export type DepositPhaseState =
  | { readonly phase: 'checking' }
  | { readonly phase: 'needs-funding' }
  | { readonly phase: 'wrong-chain' }
  | { readonly phase: 'no-gas' }
  | { readonly phase: 'ready' }
  | { readonly phase: 'signing' }
  | { readonly phase: 'sent'; readonly transactionHash: `0x${string}` }
  | { readonly phase: 'credited'; readonly transactionHash: `0x${string}` }
  | { readonly phase: 'error'; readonly errorReason: DepositFlowErrorReason }

/**
 * The full reducer state: the always-present amount/balance fields plus the
 * phase-discriminated slice. Collapses the six flat `useState` calls into one
 * machine (WR-DF-01).
 */
export type DepositFlowMachineState = {
  /** Live wallet USDC balance in whole units. */
  readonly walletUsdc: number
  /** The controlled amount-input string. */
  readonly amount: string
  /** Whether the user has touched the amount field yet (gates the invalid hint). */
  readonly amountTouched: boolean
} & DepositPhaseState

/**
 * Reducer actions. Each names a transition the hook dispatches; the reducer is
 * the single place phase + its phase-specific data change together.
 */
export type DepositFlowAction =
  | { readonly type: 'PREFLIGHT_STARTED' }
  | { readonly type: 'BALANCE_TICK'; readonly walletUsdc: number }
  | { readonly type: 'PREFLIGHT_RESOLVED'; readonly phase: DepositBranchPhase; readonly walletUsdc: number }
  | { readonly type: 'FUNDING_ARRIVED'; readonly walletUsdc: number }
  /** A wallet-rejected chain switch is non-destructive: return to `wrong-chain`. */
  | { readonly type: 'SWITCH_REJECTED' }
  | { readonly type: 'SUBMITTED' }
  /** A wallet-rejected transfer is non-destructive: return to `ready` (amount kept). */
  | { readonly type: 'TRANSFER_REJECTED' }
  | { readonly type: 'TRANSFER_SENT'; readonly transactionHash: `0x${string}` }
  | { readonly type: 'CREDITED' }
  | { readonly type: 'FAILED'; readonly reason: DepositFlowErrorReason }
  | { readonly type: 'AMOUNT_CHANGED'; readonly amount: string }
  | { readonly type: 'RETRY' }

export interface DepositFlowState {
  readonly phase: DepositPhase
  /** Live wallet USDC balance in whole units (drives the `needs-funding` ticker). */
  readonly walletUsdc: number
  /** The controlled amount-input string. */
  readonly amount: string
  /** `true` when `amount` parses to a value in `[MIN, walletUsdc]`. */
  readonly isAmountValid: boolean
  /** Human-readable reason when `isAmountValid` is false, else null. */
  readonly amountInvalidReason: string | null
  /** Present only when `phase === 'error'`. */
  readonly errorReason: DepositFlowErrorReason | null
  /** The mined Arbitrum tx hash, present from `sent` onward. */
  readonly transactionHash: `0x${string}` | null
  setAmount(next: string): void
  setAmountToMax(): void
  /** Request the wallet switch to Arbitrum One (from `wrong-chain`). */
  switchChain(): void
  /** Sign + broadcast the transfer (from `ready` / `no-gas`). */
  submit(): void
  /** Re-run the pre-flight checks after an error (never a dead-end). */
  retry(): void
}
