import type { PlaceOrderError, PlaceOrderOutcome } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatDockSymbol } from './account-dock.utils'
import { buildVenueErrorToast } from './venue-error-toast.utils'

const CLOSE_PENDING_TOAST_DURATION_MS = 60_000

// Toast copy shows the human asset name (mock 'BTC-PERP' → 'BTC', HIP-3
// 'xyz:NVDA' → 'NVDA'); the toast id and the order's cloid stay the raw symbol.
export function buildClosePendingToast(toastId: string, symbol: string): ToastPayload {
  return {
    id: toastId,
    variant: 'info',
    title: `Closing ${formatDockSymbol(symbol)}`,
    description: 'Submitting close…',
    durationMs: CLOSE_PENDING_TOAST_DURATION_MS,
  }
}

export function buildCloseOutcomeToast(
  toastId: string,
  symbol: string,
  outcome: PlaceOrderOutcome,
): ToastPayload {
  const displaySymbol = formatDockSymbol(symbol)
  if (outcome.kind === 'resting') {
    return {
      id: toastId,
      variant: 'success',
      title: 'Close order resting',
      description: `${displaySymbol} on the book`,
    }
  }
  const isPartial = outcome.kind === 'partially-filled'
  const title = isPartial ? 'Close partially filled' : 'Position closed'
  const description = `${outcome.filledSize} ${displaySymbol} @ ${outcome.averagePrice}`
  return { id: toastId, variant: 'success', title, description }
}

export function buildCloseErrorToast(toastId: string, error: PlaceOrderError): ToastPayload {
  return buildVenueErrorToast({ toastId, title: 'Close rejected', error })
}
