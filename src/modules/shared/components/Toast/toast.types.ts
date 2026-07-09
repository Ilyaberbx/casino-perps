import type { ToastRecord } from '@/modules/shared/services/toast'

export interface ToastProps {
  readonly record: ToastRecord
  readonly isExiting: boolean
  readonly onDismiss: (id: string) => void
}

export interface ToastContainerProps {
  readonly records: ReadonlyArray<ToastRecord>
  readonly exitingIds: ReadonlySet<string>
  readonly onDismiss: (id: string) => void
}
