// Pure helpers for the Agent Balance deposit / withdraw flows: Base address
// validation and USDC amount parsing. No React, no IO, no module state — every
// function here is side-effect-free (frontend-architecture.md §Utilities).

import { isAddress } from 'viem'
import { formatUsd } from '@/modules/shared/utils/format-number'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import {
  DELEGATION_ACTION,
  DELEGATION_CAP_MAX_USD,
  MIN_TRANSFER_USDC,
  MS_PER_DAY,
  USDC_DECIMALS,
} from './agent-balance.constants'
import type {
  AgentTransferErrorReason,
  AgentWalletAddress,
  BaseUsdcTransferErrorKind,
  DelegationConsentErrorReason,
  DelegationScope,
  DelegationScopeCopy,
  DelegationStatusView,
  UsdcAmountValidation,
} from './agent-balance.types'

/**
 * Narrow a free-typed destination string into a checksummed Base address.
 * Accepts only a syntactically valid EVM address (viem `isAddress`, which also
 * rejects a wrong-length / non-hex string). Returns `null` on anything else so
 * the caller surfaces a "valid number / address" hint rather than throwing.
 */
export function parseBaseAddress(raw: string): AgentWalletAddress | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (!isAddress(trimmed)) return null
  return trimmed as AgentWalletAddress
}

/**
 * Validate + parse a USDC `amount` string against an `available` balance. Valid
 * when it parses to a finite number in `[MIN_TRANSFER_USDC, available]`. Empty /
 * unparseable / out-of-range each get a plain text reason (conveyed as text, not
 * colour alone — a11y). On success it returns the parsed numeric `value` so the
 * caller transfers exactly what was validated and never re-parses the string.
 */
export function validateUsdcAmount(
  amount: string,
  available: number,
): UsdcAmountValidation {
  const trimmed = amount.trim()
  if (trimmed === '') return { isValid: false, reason: 'Enter an amount', value: null }

  const parsed = Number(trimmed)
  const isNumeric = Number.isFinite(parsed) && trimmed !== '-'
  if (!isNumeric) return { isValid: false, reason: 'Enter a valid number', value: null }

  const isBelowMin = parsed < MIN_TRANSFER_USDC
  if (isBelowMin) {
    return {
      isValid: false,
      reason: `Minimum is ${MIN_TRANSFER_USDC} USDC`,
      value: null,
    }
  }

  const exceedsAvailable = parsed > available
  if (exceedsAvailable) {
    return { isValid: false, reason: 'Amount exceeds balance', value: null }
  }

  return { isValid: true, reason: null, value: parsed }
}

/**
 * Clamp a dollar figure to USDC's 6-decimal precision and render it as a plain
 * input string (no trailing-zero padding). Used by the withdraw form's Max +
 * percent quick-fills so the amount they set validates cleanly against the
 * available balance (`validateUsdcAmount`) and never overshoots by a float
 * rounding hair. USDC is 6-decimals (`USDC_DECIMALS`).
 */
export function clampWithdrawAmount(dollars: number): string {
  const factor = 10 ** USDC_DECIMALS
  const clamped = Math.max(0, Math.floor(dollars * factor) / factor)
  return String(clamped)
}

/**
 * Validate + parse a delegation `capUsd` string. Valid when it parses to a finite
 * number in `[MIN_TRANSFER_USDC, DELEGATION_CAP_MAX_USD]`. Distinct from
 * `validateUsdcAmount` (whose upper bound is an available balance, with different
 * copy) — a cap is a spending ceiling, not a transfer of held funds. The server
 * enforces only cap > 0; the max here is a client-side guardrail.
 */
export function validateDelegationCap(capUsd: string): UsdcAmountValidation {
  const trimmed = capUsd.trim()
  if (trimmed === '') return { isValid: false, reason: 'Enter a cap', value: null }

  const parsed = Number(trimmed)
  const isNumeric = Number.isFinite(parsed) && trimmed !== '-'
  if (!isNumeric) return { isValid: false, reason: 'Enter a valid number', value: null }

  const isBelowMin = parsed < MIN_TRANSFER_USDC
  if (isBelowMin) {
    return { isValid: false, reason: `Minimum is ${MIN_TRANSFER_USDC} USDC`, value: null }
  }

  const isAboveMax = parsed > DELEGATION_CAP_MAX_USD
  if (isAboveMax) {
    return { isValid: false, reason: `Maximum is ${DELEGATION_CAP_MAX_USD} USDC`, value: null }
  }

  return { isValid: true, reason: null, value: parsed }
}

/**
 * Build the scoped delegation grant from the user-chosen `capUsd` (dollars) and
 * `ttlDays`: USDC → `recipient`, cap as an exact 2-decimal string, expiring
 * `ttlDays` after `now`. `now` is injected so the `expiresAt` instant is
 * deterministic under test. Mirrors the server `grantDelegationSchema` body.
 */
export function buildDelegationScope(
  recipient: AgentWalletAddress,
  capUsd: number,
  ttlDays: number,
  now: Date,
): DelegationScope {
  const expiresAtMs = now.getTime() + ttlDays * MS_PER_DAY
  return {
    action: DELEGATION_ACTION,
    recipient,
    capUsd: capUsd.toFixed(2),
    expiresAt: new Date(expiresAtMs).toISOString(),
  }
}

/**
 * Project a delegation status read to the *actually granted* scope, or `null`
 * when there is nothing active to show (no active row, or the server omitted the
 * cap/expiry). Used by the consent surface to render the real granted values on
 * the active card instead of the form preview.
 */
export function grantedScopeOf(
  view: DelegationStatusView,
  recipient: AgentWalletAddress,
): DelegationScope | null {
  if (view.status !== 'active') return null
  if (view.capUsd === null) return null
  if (view.expiresAt === null) return null
  return {
    action: DELEGATION_ACTION,
    recipient,
    capUsd: view.capUsd,
    expiresAt: view.expiresAt,
  }
}

/**
 * Scale a whole-USDC dollar number to the raw 6-decimal `uint256` the ERC-20
 * `transfer` takes. Built without `parseUnits(string)` so a float input never
 * round-trips through a lossy `toString` — we round to the smallest unit
 * deterministically. USDC is 6-decimals (`USDC_DECIMALS`), not 18.
 */
export function toUsdcBaseUnits(amountUsdc: number): bigint {
  const factor = 10 ** USDC_DECIMALS
  return BigInt(Math.round(amountUsdc * factor))
}

/**
 * Project a delegation `scope` down to display copy for the consent surface:
 * the truncated Minara recipient, the cap as USD, and the expiry as an ISO-8601
 * date (the date slice of the stored instant). Pure — the cap string is parsed
 * once here so the UI never re-derives it.
 */
export function formatScopeCopy(scope: DelegationScope): DelegationScopeCopy {
  return {
    recipient: formatWalletAddress(scope.recipient),
    cap: formatUsd(Number(scope.capUsd)),
    expiry: scope.expiresAt.slice(0, 10),
  }
}

/**
 * Project a transfer-port error `kind` down to the user-facing reason the
 * deposit / withdraw flows surface. `wallet-unavailable` collapses to `unknown`
 * (the UI cannot recover a missing signer mid-action); the rest map 1:1.
 */
export function mapTransferReason(
  kind: BaseUsdcTransferErrorKind,
): AgentTransferErrorReason {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'wrong-network':
      return 'wrong-network'
    case 'insufficient-gas':
      return 'insufficient-gas'
    case 'insufficient-balance':
      return 'insufficient-balance'
    case 'receipt-timeout':
      return 'receipt-timeout'
    case 'transfer-failed':
      return 'transfer-failed'
    case 'wallet-unavailable':
    case 'unknown':
      return 'unknown'
    default:
      return assertNeverTransferKind(kind)
  }
}

/**
 * Specific, user-facing copy for a delegation grant/revoke failure — so the
 * consent surface says what went wrong (and what to do) instead of a generic
 * "try again". `signer-unavailable` (the live Privy signer not wired yet) reads
 * as a coming-soon note, not a failure the User can retry away.
 */
export function delegationErrorCopy(reason: DelegationConsentErrorReason): string {
  switch (reason) {
    case 'signer-unavailable':
      return 'Popup-free signing isn’t available in this build yet — coming soon.'
    case 'signer-rejected':
      return 'Consent was declined. You can grant the delegation any time.'
    case 'signer-failed':
      return 'Couldn’t reach the signer. Try again.'
    case 'server':
      return 'Couldn’t record the delegation on the server. Try again.'
    case 'unknown':
      return 'Couldn’t update the delegation. Try again.'
    default:
      return assertNeverConsentReason(reason)
  }
}

function assertNeverConsentReason(reason: never): string {
  throw new Error(`unhandled delegation consent reason: ${String(reason)}`)
}

/** Exhaustiveness guard — a new transfer-error kind must break the build here. */
function assertNeverTransferKind(kind: never): AgentTransferErrorReason {
  throw new Error(`unhandled transfer error kind: ${String(kind)}`)
}
