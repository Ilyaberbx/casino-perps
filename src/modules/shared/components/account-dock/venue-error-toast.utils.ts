import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'
import type { VenueErrorToastInput } from './venue-error-toast.types'

// Shared skeleton for the account-dock venue-action error toasts (close /
// modify / protection / TWAP-cancel). Each delegates here: every one is an
// `error`-variant toast whose title is action-specific and whose description is
// the stripped venue error message. The optional `toastId` updates a pending
// toast in place (only the close flow shows a pending toast).
export function buildVenueErrorToast(input: VenueErrorToastInput): ToastPayload {
  const description = formatVenueErrorMessage(input.error.message)
  const hasToastId = input.toastId !== undefined
  if (!hasToastId) {
    return { variant: 'error', title: input.title, description }
  }
  return { id: input.toastId, variant: 'error', title: input.title, description }
}
