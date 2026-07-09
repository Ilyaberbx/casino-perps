import type {
  OrderTimeInForce,
  PlaceOrderOutcome,
  PlaceOrderError,
  PlaceOrderErrorKind,
  Side,
} from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import { ORDER_PENDING_TOAST_DURATION_MS, TIF_OPTIONS } from './order-entry.constants'

function sideLabel(side: Side): string {
  return side === 'buy' ? 'Long' : 'Short'
}

/** Narrows an arbitrary string (e.g. `IconSelect`'s `onChange` payload) back to
 *  the `OrderTimeInForce` union, guarding against an unexpected value without a
 *  cast. */
export function isOrderTimeInForce(value: string): value is OrderTimeInForce {
  return TIF_OPTIONS.some((option) => option.value === value)
}

/** The in-place pending toast shown the moment an order is submitted, keyed by
 *  cloid so the terminal outcome/rejection updates it rather than stacking. */
export function buildPendingOrderToast(toastId: string, side: Side, symbol: string): ToastPayload {
  const displaySymbol = formatMarketDisplaySymbol(symbol)
  return {
    id: toastId,
    variant: 'info',
    title: `Placing ${sideLabel(side)} ${displaySymbol}`,
    description: 'Submitting order…',
    durationMs: ORDER_PENDING_TOAST_DURATION_MS,
  }
}

/** Maps a successful place-order outcome to the terminal toast that replaces the
 *  pending one (same id). Filled/partial report price + size; resting reports
 *  the order is on the book. */
export function buildOutcomeToast(
  toastId: string,
  symbol: string,
  outcome: PlaceOrderOutcome,
): ToastPayload {
  const displaySymbol = formatMarketDisplaySymbol(symbol)
  if (outcome.kind === 'resting') {
    return { id: toastId, variant: 'success', title: 'Order resting', description: `${displaySymbol} on the book` }
  }
  const isPartial = outcome.kind === 'partially-filled'
  const title = isPartial ? 'Partially filled' : 'Filled'
  const description = `${outcome.filledSize} ${displaySymbol} @ ${outcome.averagePrice}`
  return { id: toastId, variant: 'success', title, description }
}

/** Maps a place-order error to the terminal toast (same id). The venue's raw
 *  rejection reason is passed through unmapped (PRD decision 5). */
export function buildOrderErrorToast(toastId: string, error: PlaceOrderError): ToastPayload {
  return {
    id: toastId,
    variant: 'error',
    title: 'Order rejected',
    description: formatVenueErrorMessage(error.message),
  }
}

/**
 * Friendly inline copy per non-`rejected` place-order failure (mirrors
 * `portfolio`'s `CHART_ERROR_MESSAGE`). `rejected` is excluded because it
 * carries the venue's own raw reason, surfaced verbatim (PRD decision 5 /
 * PRD-0007). The `Record` over the exhaustive kind union is the exhaustiveness
 * check: a new `PlaceOrderErrorKind` fails to compile until it gets copy here.
 */
export const PLACE_ORDER_ERROR_COPY: Record<
  Exclude<PlaceOrderErrorKind, 'rejected'>,
  string
> = {
  'invalid-size': "That size isn't valid for this market. Adjust it and try again.",
  'invalid-price': "That price isn't valid for this market. Adjust it and try again.",
  'unknown-symbol': "This market isn't available right now.",
  'book-empty': 'No liquidity to fill this order right now — try a limit order.',
  'unsupported-order-type': "This venue doesn't support that order type.",
}

/**
 * The inline error message shown under the order ticket on a failed submit.
 * `rejected` surfaces the venue's raw reason verbatim (label stripped, PRD
 * decision 5); every other kind maps to friendly copy so the user never sees a
 * bare technical string. Distinct from `buildOrderErrorToast`, which always
 * passes the venue reason through for the toast surface.
 */
export function placeOrderErrorMessage(error: PlaceOrderError): string {
  if (error.kind === 'rejected') return formatVenueErrorMessage(error.message)
  return PLACE_ORDER_ERROR_COPY[error.kind]
}
