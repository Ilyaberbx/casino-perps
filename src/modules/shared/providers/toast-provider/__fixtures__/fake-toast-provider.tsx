import { useMemo, useState, type ReactNode } from 'react'
import { ToastContext } from '../toast-provider.context'
import {
  buildToastRecord,
  type ToastApi,
  type ToastPayload,
  type ToastRecord,
} from '@/modules/shared/services/toast'
import type { ToastContextValue } from '../toast-provider.types'

interface FakeToastProviderProps {
  readonly children: ReactNode
  readonly onCapture?: (payload: ToastPayload) => void
}

export function FakeToastProvider({ children, onCapture }: FakeToastProviderProps) {
  const [records, setRecords] = useState<ToastRecord[]>([])

  const api = useMemo<ToastApi>(
    () => ({
      show(payload: ToastPayload): string {
        if (onCapture) onCapture(payload)
        const record = buildToastRecord(payload, Date.now())
        setRecords((current) => {
          const existing = current.findIndex((r) => r.id === record.id)
          const isDup = existing !== -1
          if (isDup) {
            const next = [...current]
            next[existing] = record
            return next
          }
          return [...current, record]
        })
        return record.id
      },
      dismiss(id: string): void {
        setRecords((current) => current.filter((r) => r.id !== id))
      },
      dismissAll(): void {
        setRecords([])
      },
    }),
    [onCapture],
  )

  const value = useMemo<ToastContextValue>(
    () => ({ toasts: records, api }),
    [records, api],
  )

  return <ToastContext value={value}>{children}</ToastContext>
}
