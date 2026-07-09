import type { ModifyOrderError } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { buildVenueErrorToast } from './venue-error-toast.utils'

export function buildModifyAppliedToast(symbol: string): ToastPayload {
  return { variant: 'success', title: 'Order modified', description: `${symbol} updated` }
}

export function buildModifyErrorToast(error: ModifyOrderError): ToastPayload {
  return buildVenueErrorToast({ title: 'Order not modified', error })
}
