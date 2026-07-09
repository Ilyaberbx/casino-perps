import type { MarginMode, SetLeverageError, SetMarginModeError } from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'
import { formatVenueErrorMessage } from '@/modules/shared/utils/format-venue-error-message'

function marginModeLabel(mode: MarginMode): string {
  return mode === 'cross' ? 'Cross' : 'Isolated'
}

export function buildLeverageAppliedToast(symbol: string, leverage: number): ToastPayload {
  return {
    variant: 'success',
    title: 'Leverage updated',
    description: `${formatMarketDisplaySymbol(symbol)} set to ${leverage}×`,
  }
}

export function buildLeverageErrorToast(error: SetLeverageError): ToastPayload {
  return {
    variant: 'error',
    title: 'Leverage not updated',
    description: formatVenueErrorMessage(error.message),
  }
}

export function buildMarginModeAppliedToast(symbol: string, mode: MarginMode): ToastPayload {
  return {
    variant: 'success',
    title: 'Margin mode updated',
    description: `${formatMarketDisplaySymbol(symbol)} set to ${marginModeLabel(mode)}`,
  }
}

export function buildMarginModeErrorToast(error: SetMarginModeError): ToastPayload {
  return {
    variant: 'error',
    title: 'Margin mode not updated',
    description: formatVenueErrorMessage(error.message),
  }
}
