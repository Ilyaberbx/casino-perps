import { useContext } from 'react'
import { ToastContext } from './toast-provider.context'
import type { ToastApi } from '@/modules/shared/services/toast'

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  const isMissing = context === null
  if (isMissing) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return context.api
}
