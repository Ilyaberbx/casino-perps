import { parseWalletAddress } from '@/modules/shared/domain'
import type { Balance } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGatewayErrorKind } from '../../gateway/hyperliquid-gateway.types'
import {
  countDecimals,
  failFlow,
  mapGatewayErrorToFlowError,
  percentOfAvailable,
  readUsdcAvailable as readUsdcAvailableShared,
} from '../flow-machine/flow.utils'
import type { AmountValidation } from '../flow-machine/flow.utils'
import type {
  WithdrawError,
  WithdrawFlowAction,
  WithdrawPercent,
} from './withdraw-flow-provider.types'
import {
  MIN_WITHDRAW_USDC,
  USDC_WITHDRAW_DECIMALS,
  WITHDRAW_FEE_USDC,
} from './withdraw-flow.constants'

export type WithdrawAmountValidation = AmountValidation

/**
 * Validate the entered USDC `amount` against the live `withdrawable` balance.
 * Valid when it parses to a finite number in `[MIN_WITHDRAW_USDC, withdrawable]`
 * with at most `USDC_WITHDRAW_DECIMALS` fractional digits. Empty / unparseable /
 * non-positive / below-min / over-balance / over-precision each get a plain
 * reason string (text, not colour — a11y). On success returns the parsed numeric
 * `value` so the caller withdraws exactly what was validated.
 */
export function validateWithdrawAmount(
  amount: string,
  withdrawable: number,
): WithdrawAmountValidation {
  const trimmed = amount.trim()
  if (trimmed === '') return { isValid: false, reason: 'Enter an amount', value: null }

  const parsed = Number(trimmed)
  const isNumeric = Number.isFinite(parsed) && trimmed !== '-'
  if (!isNumeric) return { isValid: false, reason: 'Enter a valid number', value: null }

  const isNonPositive = parsed <= 0
  if (isNonPositive) return { isValid: false, reason: 'Enter an amount above 0', value: null }

  const exceedsPrecision = countDecimals(trimmed) > USDC_WITHDRAW_DECIMALS
  if (exceedsPrecision) {
    return {
      isValid: false,
      reason: `Use at most ${USDC_WITHDRAW_DECIMALS} decimal places`,
      value: null,
    }
  }

  const isBelowMin = parsed < MIN_WITHDRAW_USDC
  if (isBelowMin) {
    return { isValid: false, reason: `Withdraw at least ${MIN_WITHDRAW_USDC} USDC`, value: null }
  }

  const exceedsBalance = parsed > withdrawable
  if (exceedsBalance) {
    return { isValid: false, reason: 'Amount exceeds withdrawable balance', value: null }
  }

  return { isValid: true, reason: null, value: parsed }
}

/** Read the USDC row's available balance from a balances projection, or 0. */
export const readUsdcAvailable = readUsdcAvailableShared

/**
 * The withdrawable USDC cap, read from the account-mode-correct scope.
 *
 * `withdraw3` withdraws from the account's collateral pool, which differs by
 * account mode (hyperliquid-account-modes.md §1/§3):
 * - **segregated** (classic) → the `'perps'`-scope USDC `available` (the perp
 *   `clearinghouseState.withdrawable`). Spot USDC is NOT directly withdrawable —
 *   it must first be moved with a Spot→Perp transfer (which IS offered for
 *   segregated accounts), so the perps scope is the correct read.
 * - **unified / portfolio margin** → the `'all'`-scope USDC `available` (the
 *   single unified collateral pool, `source: 'unified'`). The `'perps'` scope is
 *   deliberately EMPTY for unified accounts (`balances-reader` returns `[]` to
 *   avoid a phantom ~0 row), so reading it would strand a unified user at $0 —
 *   the bug this selector fixes. Withdraw is a unified user's only exit (Transfer
 *   is hidden for them), so the cap must come from the unified pool.
 */
export function selectWithdrawableUsdc(
  isSegregated: boolean,
  perpsRows: ReadonlyArray<Balance>,
  allRows: ReadonlyArray<Balance>,
): number {
  return isSegregated ? readUsdcAvailable(perpsRows) : readUsdcAvailable(allRows)
}

/** `true` when `destination` parses to a valid `0x` + 40-hex wallet address. */
export function isValidDestination(destination: string): boolean {
  return parseWalletAddress(destination.trim()).isOk()
}

/**
 * The amount for a percentage of the withdrawable balance, clamped to 6 decimals
 * (USDC precision) so the resulting string is always a valid amount. Returns ''
 * when nothing is withdrawable so the field clears rather than showing "0".
 */
export function percentOfWithdrawable(percent: WithdrawPercent, withdrawable: number): string {
  return percentOfAvailable(percent, withdrawable, USDC_WITHDRAW_DECIMALS)
}

/**
 * The amount that arrives on Arbitrum after the flat L1 fee, floored at 0. The
 * caller passes the validated numeric amount; a non-finite / non-positive amount
 * yields 0 (nothing arrives).
 */
export function netReceived(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.max(0, amount - WITHDRAW_FEE_USDC)
}

/**
 * Map a gateway error kind to the flow's typed `WithdrawError`. Delegates to the
 * shared `mapGatewayErrorToFlowError`; the shared output union is a subset of
 * `WithdrawError`, so the result is a valid `WithdrawError`.
 */
export function mapGatewayErrorToWithdrawError(
  kind: HyperliquidGatewayErrorKind,
): WithdrawError {
  return mapGatewayErrorToFlowError(kind)
}

/**
 * The single recoverable-abort path: warn with structured fields, then dispatch
 * `FAILED(reason)` so the machine lands on `error`. Lets the submit branch read
 * as guard clauses against one abort.
 */
export function failWithdraw(
  log: Logger,
  dispatch: (action: WithdrawFlowAction) => void,
  reason: WithdrawError,
  fields: Record<string, unknown>,
  message: string,
): void {
  failFlow<WithdrawError, Extract<WithdrawFlowAction, { type: 'FAILED' }>>(
    log,
    dispatch,
    reason,
    fields,
    message,
  )
}
