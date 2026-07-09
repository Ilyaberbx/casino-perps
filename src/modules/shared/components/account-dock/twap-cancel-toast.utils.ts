import type { CancelTwapError } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatDockSymbol } from './account-dock.utils'
import { buildVenueErrorToast } from './venue-error-toast.utils'

// Toast copy shows the human asset name (HIP-3 'xyz:NVDA' → 'NVDA'); the raw
// symbol stays the request key. Mirrors close/modify toast builders.
export function buildTwapCancelledToast(symbol: string): ToastPayload {
  return {
    variant: 'success',
    title: 'TWAP cancelled',
    description: `${formatDockSymbol(symbol)} order cancelled`,
  }
}

export function buildTwapCancelErrorToast(error: CancelTwapError): ToastPayload {
  return buildVenueErrorToast({ title: 'TWAP not cancelled', error })
}

// Bulk Cancel(N) outcome — summarises how many of the selected TWAPs cancelled
// and how many failed (the per-row toasts would flood the stack, so the fan-out
// emits a single summary).
export function buildTwapBulkCancelToast(requested: number, failed: number): ToastPayload {
  const cancelled = requested - failed
  if (failed === 0) {
    return {
      variant: 'success',
      title: 'TWAPs cancelled',
      description: `${cancelled} of ${requested} cancelled`,
    }
  }
  if (cancelled === 0) {
    return {
      variant: 'error',
      title: 'TWAP cancel failed',
      description: `${failed} of ${requested} could not be cancelled`,
    }
  }
  return {
    variant: 'warning',
    title: 'Some TWAPs not cancelled',
    description: `${cancelled} cancelled, ${failed} failed`,
  }
}
