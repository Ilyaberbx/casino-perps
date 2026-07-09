import type { SetPositionProtectionError } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatDockSymbol } from './account-dock.utils'
import { buildVenueErrorToast } from './venue-error-toast.utils'

export function buildProtectionAppliedToast(symbol: string): ToastPayload {
  return {
    variant: 'success',
    title: 'TP/SL updated',
    description: `${formatDockSymbol(symbol)} protection set`,
  }
}

export function buildProtectionClearedToast(symbol: string): ToastPayload {
  return {
    variant: 'success',
    title: 'TP/SL cleared',
    description: `${formatDockSymbol(symbol)} protection removed`,
  }
}

export function buildProtectionErrorToast(error: SetPositionProtectionError): ToastPayload {
  return buildVenueErrorToast({ title: 'TP/SL not updated', error })
}
