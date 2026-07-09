import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidGatewayErrorKind } from '../../gateway/hyperliquid-gateway.types'
import {
  failFlow,
  mapGatewayErrorToFlowError,
  validateAmountInRange,
} from '../flow-machine/flow.utils'
import type { AmountValidation } from '../flow-machine/flow.utils'
import type {
  TransferAccount,
  TransferError,
  TransferFlowAction,
} from './transfer-flow-provider.types'
import { USDC_TRANSFER_DECIMALS } from './transfer-flow.constants'

export type TransferAmountValidation = AmountValidation

/**
 * Validate the entered USDC `amount` against the live available balance of the
 * source account. Valid when it parses to a finite number in `(0, available]`
 * with at most `USDC_TRANSFER_DECIMALS` fractional digits. Empty / unparseable /
 * non-positive / over-balance / over-precision each get a plain reason string
 * (text, not colour — a11y). On success returns the parsed numeric `value` so
 * the caller transfers exactly what was validated, never re-parsing the string.
 */
export function validateTransferAmount(
  amount: string,
  available: number,
): TransferAmountValidation {
  return validateAmountInRange(amount, available, USDC_TRANSFER_DECIMALS)
}

/** The account opposite `from` (USDC moves between exactly two accounts). */
export function oppositeAccount(from: TransferAccount): TransferAccount {
  return from === 'spot' ? 'perps' : 'spot'
}

/**
 * Map a gateway error kind to the flow's typed `TransferError`. Delegates to the
 * shared `mapGatewayErrorToFlowError`; the shared output union is a subset of
 * `TransferError`, so the result is a valid `TransferError`.
 */
export function mapGatewayErrorToTransferError(
  kind: HyperliquidGatewayErrorKind,
): TransferError {
  return mapGatewayErrorToFlowError(kind)
}

/**
 * The single recoverable-abort path: warn with structured fields, then dispatch
 * `FAILED(reason)` so the machine lands on `error`. Lets the submit branch read
 * as guard clauses against one abort.
 */
export function failTransfer(
  log: Logger,
  dispatch: (action: TransferFlowAction) => void,
  reason: TransferError,
  fields: Record<string, unknown>,
  message: string,
): void {
  failFlow<TransferError, Extract<TransferFlowAction, { type: 'FAILED' }>>(
    log,
    dispatch,
    reason,
    fields,
    message,
  )
}
