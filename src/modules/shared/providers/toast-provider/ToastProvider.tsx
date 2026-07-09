import { useMemo } from 'react'
import { ToastContainer } from '@/modules/shared/components/Toast'
import { ToastContext } from './toast-provider.context'
import { useToastProvider } from './use-toast-provider'
import type { ToastContextValue, ToastProviderProps } from './toast-provider.types'

export function ToastProvider({ children }: ToastProviderProps) {
  const { toasts, exitingIds, api, dismiss } = useToastProvider()
  const value = useMemo<ToastContextValue>(() => ({ toasts, api }), [toasts, api])
  return (
    <ToastContext value={value}>
      {children}
      <ToastContainer records={toasts} exitingIds={exitingIds} onDismiss={dismiss} />
    </ToastContext>
  )
}
