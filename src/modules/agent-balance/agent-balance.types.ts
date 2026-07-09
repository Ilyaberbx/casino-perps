import type { ResultAsync } from 'neverthrow'
import type { RecipientSuggestion } from '@/modules/shared/components/recipient-combobox'

/** Agent Wallet address as returned by the server read route. */
export type AgentWalletAddress = `0x${string}`

/**
 * The single failure tag the reader surfaces (RPC reject / decode failure).
 */
export type BalanceReadFailed = { kind: 'balance-read-failed'; cause: unknown }

/**
 * Reads the User's Agent Wallet USDC balance on Base and returns it as a USD
 * dollar number (raw 6-decimal units divided down). Venue-independent: this is
 * NOT a Venue/Adapter `Balance` row — it is the on-chain Base USDC figure
 * behind the Agent Balance tile.
 */
export interface BaseUsdcBalanceReader {
  readUsdcBalance(
    address: AgentWalletAddress,
  ): ResultAsync<number, BalanceReadFailed>
}

/**
 * The minimal slice of a viem `PublicClient` the reader depends on: a single
 * `readContract` call returning the raw `uint256` balance as a `bigint`. The
 * reader is built against this narrow shape so it is unit-testable with a fake
 * — it never reaches into the rest of the viem client surface.
 */
export interface UsdcBalanceClient {
  readContract(args: {
    address: AgentWalletAddress
    abi: typeof import('./agent-balance.constants').ERC20_BALANCE_OF_ABI
    functionName: 'balanceOf'
    args: readonly [AgentWalletAddress]
  }): Promise<bigint>
}

/**
 * The live Agent Balance reading, exposed as the module's public hook return
 * (`useAgentBalance`). `balanceUsd` is the raw dollar number (or `null` when
 * disconnected / unread) so cross-module callers can reconcile it against other
 * balance sources; `display` is the same figure pre-formatted via `formatUsd`
 * (`$0.00` when empty / disconnected). Venue-independent — the on-chain Base
 * USDC figure, never DEX collateral.
 */
export interface AgentBalanceViewModel {
  readonly balanceUsd: number | null
  readonly display: string
  /**
   * The Agent Wallet address once the server read resolves (or once it is
   * created + registered on a 404), else `null`. Exposed so the Account Modal can
   * gate the Agent Wallet's "Export key" affordance on session membership
   * (`useAuth().exportableAddresses`, ADR-0078 — the Agent Wallet is user-owned by
   * construction, so plain membership is the gate; no server ownership marker).
   * `null` while disconnected or before the read resolves.
   */
  readonly agentWalletAddress: AgentWalletAddress | null
  /**
   * The read lifecycle so consumers can show a loading state instead of treating
   * the pre-read `$0.00` as a real balance (the `display`/`balanceUsd` pair alone
   * cannot tell "loading" from "loaded zero"): `idle` when disconnected, `loading`
   * while the on-chain read is in flight, `ready` once it resolves, `error` when
   * the address fetch or balance read failed.
   */
  readonly status: AgentBalanceStatus
}

/** The Agent Balance read lifecycle (see `AgentBalanceViewModel.status`). */
export type AgentBalanceStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The shape the smart hook returns to the dumb tile. */
export type AgentBalanceTileViewModel = {
  /** Pre-formatted USD string, e.g. `$12.50`; `$0.00` when empty/disconnected. */
  display: string
  /** Read lifecycle so the tile shows a skeleton while loading (not a fake `$0.00`). */
  status: AgentBalanceStatus
}

// ---------------------------------------------------------------------------
// Deposit / withdraw (issue #211)
// ---------------------------------------------------------------------------

/** Result of validating + parsing a USDC amount string against an available balance. */
export type UsdcAmountValidation =
  | { readonly isValid: false; readonly reason: string; readonly value: null }
  | { readonly isValid: true; readonly reason: null; readonly value: number }

/**
 * The discriminated failure surface of the Base USDC transfer port. Every
 * fallible method returns a `ResultAsync<_, BaseUsdcTransferError>`; the flow
 * hooks map each `kind` to a user-facing reason. `wallet-rejected` lets the
 * machine return non-destructively (amount/destination preserved).
 * `insufficient-gas` (viem `InsufficientFundsError`) and `insufficient-balance`
 * (a reverted `ContractFunctionRevertedError`, or a mined receipt with
 * `status: 'reverted'`) are distinct, oppositely-actionable causes ("send ETH"
 * vs. "lower the amount") that must never collapse into one bucket.
 * `receipt-timeout` (viem `WaitForTransactionReceiptTimeoutError`) is not a
 * failure — the broadcast succeeded and the transfer may still land.
 */
export type BaseUsdcTransferErrorKind =
  | 'wallet-unavailable'
  | 'wallet-rejected'
  | 'wrong-network'
  | 'insufficient-gas'
  | 'insufficient-balance'
  | 'receipt-timeout'
  | 'transfer-failed'
  | 'unknown'

export class BaseUsdcTransferError extends Error {
  readonly kind: BaseUsdcTransferErrorKind
  constructor(kind: BaseUsdcTransferErrorKind, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'BaseUsdcTransferError'
  }
}

/** A mined Base transfer — money left the source wallet. */
export interface BaseUsdcTransferReceipt {
  readonly transactionHash: `0x${string}`
}

/**
 * WITHDRAW port: sends USDC OUT of the Agent Wallet to a user-specified Base
 * address via an EXPLICIT per-action authorization — a fresh signature the User
 * approves for THIS withdrawal (ADR-0046 D-7). It is categorically NOT the
 * standing, popup-free delegation (which is scoped to Minara x402 + CCTP and can
 * only move funds to known recipients). `authorizeAndSend` is the per-action
 * signing path; a delegated signer must never satisfy this interface.
 */
export interface AgentWithdrawAuthorizer {
  /**
   * Prompt the User for a fresh, explicit authorization and, on approval, send
   * `USDC.transfer(destination, amount)` from the Agent Wallet on Base.
   * `amountUsdc` is whole USDC units. A user-cancelled prompt surfaces
   * `wallet-rejected`; a funds-to-anywhere transfer is never folded into the
   * standing delegation.
   */
  authorizeAndSend(
    destination: AgentWalletAddress,
    amountUsdc: number,
  ): ResultAsync<BaseUsdcTransferReceipt, BaseUsdcTransferError>
}

/**
 * Reason surfaced to the withdraw UI when an action fails. A malformed
 * destination never reaches this union — it gates `canSubmit` off at the input
 * (the flow cannot fire), so there is no `invalid-destination` reason to surface.
 */
export type AgentTransferErrorReason =
  | 'wallet-rejected'
  | 'wrong-network'
  | 'insufficient-gas'
  | 'insufficient-balance'
  | 'receipt-timeout'
  | 'transfer-failed'
  | 'unknown'

// ---------------------------------------------------------------------------
// Scoped, revocable delegation (issue #205)
// ---------------------------------------------------------------------------

/**
 * The only delegation action the scope can ever name. There is deliberately no
 * free-recipient transfer variant — arbitrary-address transfer is NOT
 * representable. Mirrors the server `DelegationAction` literal.
 */
export type DelegationAction = 'usdc-transfer-with-authorization'

/**
 * The user-facing delegation lifecycle, mirrored from the server read route
 * (`GET /api/agent-treasury/delegation` → `{ status }`): `not-granted` (no
 * standing signer), `active` (scoped signer registered and unexpired),
 * `expired` (past `expiresAt`), `revoked` (the User pulled the grant).
 */
export type DelegationStatus =
  | 'not-granted'
  | 'active'
  | 'expired'
  | 'revoked'

/**
 * The caller-supplied scope of a delegation grant. `recipient` is the configured
 * Minara x402 recipient (the ONLY address the standing signer may pay);
 * `capUsd` is an exact-decimal string ceiling; `expiresAt` is an ISO-8601
 * instant. Mirrors the server `grantDelegationSchema` body byte-for-byte so the
 * POST is the response-shape contract. The recipient-allowlist + cap make a
 * funds-to-anywhere transfer impossible (ADR-0044 D-2).
 */
export interface DelegationScope {
  readonly action: DelegationAction
  readonly recipient: AgentWalletAddress
  readonly capUsd: string
  readonly expiresAt: string
}

/**
 * The server's PREPARE response (ADR-0078 grant step 1): the app's scoped signer
 * id + the freshly created policy id. The client attaches the signer with these
 * (`attachAgentSigner`) before the server confirms + persists the row.
 */
export interface PreparedDelegation {
  readonly appSignerId: string
  readonly policyId: string
}

/**
 * The server's delegation read (ADR-0078): the user-facing `status`, the app's
 * registered `appSignerId` (present on an `active` delegation, else `null` — the
 * revoke path reads it to `removeAgentSigner` in a later session), and the
 * *actually granted* `capUsd` / `expiresAt` from the persisted row (`null` when
 * not-granted) so the active card shows the real scope, not the form preview.
 */
export interface DelegationStatusView {
  readonly status: DelegationStatus
  readonly appSignerId: string | null
  readonly capUsd: string | null
  readonly expiresAt: string | null
}

/**
 * The Privy seam for ATTACHING the app as a scoped additional signer on the
 * Agent Wallet (ADR-0078 grant step 2). Resolves `true` on the owner's
 * confirmation, `false` on decline (→ `signer-rejected`). Injected from
 * `useAuth().attachAgentSigner` so this module never imports the Privy SDK
 * (import-boundary asserted by test).
 */
export type AttachAgentSigner = (input: {
  address: AgentWalletAddress
  appSignerId: string
  policyId: string
}) => Promise<boolean>

/**
 * The Privy seam for REMOVING the app signer on revoke (ADR-0078). Injected from
 * `useAuth().removeAgentSigner`; called BEFORE the server marks the row revoked.
 * Mirrors `AttachAgentSigner`: resolves `true` when removal succeeds OR is a
 * best-effort no-op (a benign Privy throw such as the signer already being gone —
 * swallowed so the authoritative server row-revoke still runs and a stuck-Active
 * delegation self-heals); resolves `false` only when the owner declines the
 * removal confirmation (a `cancelled` throw ⇒ non-destructive `signer-rejected`).
 */
export type RemoveAgentSigner = (input: {
  address: AgentWalletAddress
  appSignerId: string
}) => Promise<boolean>

/**
 * The discriminated failure surface of the delegation-grant seam (ADR-0078).
 * `signer-rejected` is the owner declining the Privy `addSigners` confirmation
 * (non-destructive — the confirm step never runs); `signer-failed` wraps a Privy
 * `addSigners`/`removeSigners` throw; `server` wraps a server prepare / confirm /
 * revoke `HttpError`. The consent hook maps each to a user-facing reason and
 * never throws.
 */
export type DelegationGrantErrorKind =
  | 'signer-rejected'
  | 'signer-failed'
  | 'server'

export class DelegationGrantError extends Error {
  readonly kind: DelegationGrantErrorKind
  constructor(kind: DelegationGrantErrorKind, message: string, cause?: unknown) {
    super(message)
    this.kind = kind
    this.cause = cause
    this.name = 'DelegationGrantError'
  }
}

/**
 * The delegation-grant seam: a one-shot port the consent hook drives. `grant`
 * runs the ADR-0078 3-step handshake — PREPARE (server creates the scoped policy,
 * persists nothing) → ATTACH (client `attachAgentSigner` — false ⇒
 * `signer-rejected`) → CONFIRM (server persists the row `active`) — resolving the
 * resulting `DelegationStatus`. `revoke` removes the app signer client-side FIRST
 * (`removeAgentSigner`, read from the standing status' `appSignerId`) THEN marks
 * the server row revoked.
 *
 * The Privy attach/remove halves are injected so the delegation code never
 * imports the Privy SDK directly (import-boundary asserted by test).
 */
export interface DelegationGrantPort {
  grant(
    scope: DelegationScope,
  ): ResultAsync<DelegationStatus, DelegationGrantError>
  revoke(): ResultAsync<DelegationStatus, DelegationGrantError>
}

/**
 * Reason surfaced to the consent UI when a grant / revoke fails. `signer-rejected`
 * is the User declining the Privy consent popup — non-destructive, the consent
 * surface stays on offer.
 */
export type DelegationConsentErrorReason =
  | 'signer-rejected'
  | 'signer-failed'
  | 'server'
  | 'signer-unavailable'
  | 'unknown'

/** The delegation-consent machine phase. */
export type DelegationConsentPhase =
  | 'loading'
  | 'idle'
  | 'granting'
  | 'revoking'
  | 'error'

/** Pre-formatted scope copy for display on the consent surface. */
export interface DelegationScopeCopy {
  /** The truncated Minara recipient, e.g. `0x…1234`. */
  readonly recipient: string
  /** The cap rendered as USD, e.g. `$50.00`. */
  readonly cap: string
  /** The expiry rendered as an ISO-8601 date, e.g. `2026-07-12`. */
  readonly expiry: string
}

/** The shape the delegation-consent smart hook returns to the dumb body. */
export interface DelegationConsentViewModel {
  readonly phase: DelegationConsentPhase
  /** The server-read lifecycle status (drives the status copy + control). */
  readonly status: DelegationStatus
  /** Whether the standing signer is currently active (grant offered when false). */
  readonly isActive: boolean
  /**
   * The scope copy (recipient / cap / expiry) for display. When active it is the
   * *granted* scope from the server; while editing it is the live preview derived
   * from the current cap + ttl inputs.
   */
  readonly scope: DelegationScopeCopy
  /** The controlled cap (USDC) string — the grant amount the user configures. */
  readonly capUsd: string
  /** Non-null when the cap input is invalid (text reason, a11y). */
  readonly capInvalidReason: string | null
  /** The chosen TTL in days (one of `ttlPresets`). */
  readonly ttlDays: number
  /** The TTL preset options (days) the chips render. */
  readonly ttlPresets: readonly number[]
  /** `true` only when the cap validates — gates the grant control. */
  readonly canGrant: boolean
  readonly errorReason: DelegationConsentErrorReason | null
  setCapUsd(next: string): void
  setTtlDays(next: number): void
  /** Grant the one-time scoped delegation (registers the signer + records it). */
  grant(): void
  /** Revoke the standing delegation. */
  revoke(): void
}

/**
 * The withdraw-flow machine phase. `editing` collects destination + amount;
 * `authorizing` is the explicit per-action signature in flight; `sent` is the
 * mined transfer; `error` is non-terminal with a retry.
 */
export type WithdrawFlowPhase = 'editing' | 'authorizing' | 'sent' | 'error'

/** The shape the withdraw smart hook returns to the dumb withdraw body. */
export interface WithdrawFlowViewModel {
  readonly phase: WithdrawFlowPhase
  /** The controlled destination Base address string. */
  readonly destination: string
  readonly isDestinationValid: boolean
  /** `true` once the User has typed anything into the destination (drives the irreversible gate). */
  readonly isDestinationEdited: boolean
  /** The controlled USDC amount string. */
  readonly amount: string
  readonly isAmountValid: boolean
  readonly amountInvalidReason: string | null
  /** The Agent Wallet's available USDC — the withdrawable balance (Max / percent + available line). */
  readonly withdrawable: number
  /** The minimum withdrawal (`MIN_TRANSFER_USDC`), surfaced in the summary. */
  readonly minWithdraw: number
  /** The net USDC the destination receives (no fee on a direct Base transfer → equals the amount). */
  readonly netReceived: number
  /** Whether the User has ticked the irreversible-acknowledgement checkbox. */
  readonly confirmedIrreversible: boolean
  /** `true` only when destination + amount validate AND the irreversible box is ticked. */
  readonly canSubmit: boolean
  /** The user's own wallets offered as destination suggestions. */
  readonly walletSuggestions: ReadonlyArray<RecipientSuggestion>
  /** Addresses the user recently sent to, offered as destination suggestions. */
  readonly recentSuggestions: ReadonlyArray<RecipientSuggestion>
  readonly errorReason: AgentTransferErrorReason | null
  readonly transactionHash: `0x${string}` | null
  setDestination(next: string): void
  setAmount(next: string): void
  /** Fill the amount with the full withdrawable balance. */
  setAmountToMax(): void
  /** Fill the amount with `percent`% of the withdrawable balance. */
  setPercent(percent: number): void
  /** Toggle the irreversible-acknowledgement checkbox. */
  toggleConfirmIrreversible(): void
  /** Trigger the explicit per-action authorization + send. */
  authorize(): void
  retry(): void
}
