import { TOAST_DEFAULT_DURATION_MS } from './toast.constants'
import type { ToastPayload, ToastRecord } from './toast.types'

let autoIdCounter = 0

function nextAutoId(): string {
  autoIdCounter += 1
  return `toast-${autoIdCounter}`
}

export function buildToastRecord(payload: ToastPayload, now: number): ToastRecord {
  const id = payload.id ?? nextAutoId()
  const durationMs = payload.durationMs ?? TOAST_DEFAULT_DURATION_MS[payload.variant]
  return {
    id,
    variant: payload.variant,
    title: payload.title,
    durationMs,
    description: payload.description,
    action: payload.action,
    createdAt: now,
  }
}
