import type { ReactNode } from 'react'
import type { ToastApi, ToastRecord } from '@/modules/shared/services/toast'

export interface ToastProviderProps {
  readonly children: ReactNode
}

export interface ToastContextValue {
  readonly toasts: ReadonlyArray<ToastRecord>
  readonly api: ToastApi
}
