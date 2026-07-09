import { imperativeToastQueue } from './imperative-toast-queue'
import { buildToastRecord } from './toast.utils'
import type { ToastApi, ToastPayload } from './toast.types'

export const toast: ToastApi = {
  show(payload: ToastPayload): string {
    const record = buildToastRecord(payload, Date.now())
    imperativeToastQueue.enqueue({ kind: 'show', record })
    return record.id
  },
  dismiss(id: string): void {
    imperativeToastQueue.enqueue({ kind: 'dismiss', id })
  },
  dismissAll(): void {
    imperativeToastQueue.enqueue({ kind: 'dismiss-all' })
  },
}
