import type { Balance } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import { USDC_SYMBOL } from '../../hyperliquid.constants'
import type { HyperliquidGatewayErrorKind } from '../../gateway/hyperliquid-gateway.types'

/**
 * The subset of gateway error kinds the fund-movement flows all map 1:1, plus
 * `unknown` as the collapse target for everything else. Each per-flow `*Error`
 * union is a superset of this, so `mapGatewayErrorToFlowError`'s output is a
 * valid value for every flow's own error type — the per-flow wrappers narrow it
 * back to their own union for free.
 */
export type FlowGatewayError =
  | 'wallet-rejected'
  | 'deposit-required'
  | 'rate-limited'
  | 'network'
  | 'unknown'

/**
 * Validation result shared by every fund-movement amount validator: a typed
 * failure carrying a plain a11y reason string, or a success carrying the parsed
 * numeric `value` so the caller acts on exactly what was validated.
 */
export type AmountValidation =
  | { readonly isValid: false; readonly reason: string; readonly value: null }
  | { readonly isValid: true; readonly reason: null; readonly value: number }

/** Count the fractional digits in a numeric string (`"1.250" → 3`). */
export function countDecimals(value: string): number {
  const dotIndex = value.indexOf('.')
  if (dotIndex === -1) return 0
  return value.length - dotIndex - 1
}

/** Read the USDC row's available balance from a balances projection, or 0. */
export function readUsdcAvailable(rows: ReadonlyArray<Balance>): number {
  const usdc = rows.find((row) => row.asset === USDC_SYMBOL)
  return usdc?.available ?? 0
}

/**
 * Resolve the selected token from the list by key, falling back to the first
 * token when the key has drifted (e.g. the selected token's balance dropped to
 * zero and it left the list). `null` only when the list is empty. Generic over
 * any token carrying a stable `key`.
 */
export function resolveSelectedToken<TToken extends { readonly key: string }>(
  tokens: ReadonlyArray<TToken>,
  key: string,
): TToken | null {
  const exact = tokens.find((token) => token.key === key)
  if (exact !== undefined) return exact
  return tokens[0] ?? null
}

/**
 * The amount for a percentage of an available balance, floored to the token's
 * `decimals` precision so the resulting string is always a valid amount. Returns
 * '' when nothing is available so the field clears rather than showing "0".
 */
export function percentOfAvailable(
  percent: number,
  available: number,
  decimals: number,
): string {
  if (available <= 0) return ''
  const factor = 10 ** decimals
  const raw = (available * percent) / 100
  const rounded = Math.floor(raw * factor) / factor
  return rounded.toString()
}

/**
 * The core `(0, available]` amount validator shared by every fund-movement flow.
 * Valid when the input parses to a finite number in `(0, available]` with at
 * most `decimals` fractional digits. Empty / unparseable / non-positive /
 * over-precision / over-balance each get a plain reason string (text, not
 * colour — a11y). Flows with extra rules (e.g. a withdraw minimum) compose them
 * around this base.
 */
export function validateAmountInRange(
  amount: string,
  available: number,
  decimals: number,
): AmountValidation {
  const trimmed = amount.trim()
  if (trimmed === '') return { isValid: false, reason: 'Enter an amount', value: null }

  const parsed = Number(trimmed)
  const isNumeric = Number.isFinite(parsed) && trimmed !== '-'
  if (!isNumeric) return { isValid: false, reason: 'Enter a valid number', value: null }

  const isNonPositive = parsed <= 0
  if (isNonPositive) return { isValid: false, reason: 'Enter an amount above 0', value: null }

  const exceedsPrecision = countDecimals(trimmed) > decimals
  if (exceedsPrecision) {
    return { isValid: false, reason: `Use at most ${decimals} decimal places`, value: null }
  }

  const exceedsBalance = parsed > available
  if (exceedsBalance) {
    return { isValid: false, reason: 'Amount exceeds available balance', value: null }
  }

  return { isValid: true, reason: null, value: parsed }
}

/**
 * Map a gateway error kind to the shared `FlowGatewayError`. Typed against
 * `HyperliquidGatewayErrorKind` (not a re-declared literal union) so a new
 * gateway kind is a typecheck failure here rather than silent drift. The `never`
 * arm proves exhaustiveness. Each flow re-exports a wrapper that narrows the
 * output to its own (superset) error union.
 */
export function mapGatewayErrorToFlowError(kind: HyperliquidGatewayErrorKind): FlowGatewayError {
  switch (kind) {
    case 'wallet-rejected':
      return 'wallet-rejected'
    case 'deposit-required':
      return 'deposit-required'
    case 'rate-limited':
      return 'rate-limited'
    case 'network':
      return 'network'
    case 'invalid-response':
    case 'unknown-address':
    case 'chain-mismatch':
    case 'builder-not-funded':
    case 'approval-cap-reached':
    case 'agent-cap-reached':
    case 'name-collision':
    case 'agent-address-reused':
      return 'unknown'
    default: {
      const exhaustive: never = kind
      return exhaustive
    }
  }
}

/**
 * The single recoverable-abort path shared by every fund-movement flow: warn
 * with structured fields, then dispatch `FAILED(reason)` so the machine lands on
 * `error`. Lets each submit branch read as guard clauses against one abort.
 * Generic over the flow's action + reason so the dispatched `FAILED` stays
 * typed.
 */
export function failFlow<TReason, TAction extends { type: 'FAILED'; reason: TReason }>(
  log: Logger,
  dispatch: (action: TAction) => void,
  reason: TReason,
  fields: Record<string, unknown>,
  message: string,
): void {
  log.warn(fields, message)
  dispatch({ type: 'FAILED', reason } as TAction)
}
