import type { ToastVariant } from './toast.types'

// Global auto-dismiss window: every toast variant disappears 7s after it shows
// (errors included — previously persistent). Kept as a per-variant record so a
// variant could diverge later without changing the public surface; all four are
// intentionally identical today, so the single source is this constant.
const GLOBAL_TOAST_DURATION_MS = 7000

export const TOAST_DEFAULT_DURATION_MS: Readonly<Record<ToastVariant, number>> = {
  success: GLOBAL_TOAST_DURATION_MS,
  info: GLOBAL_TOAST_DURATION_MS,
  warning: GLOBAL_TOAST_DURATION_MS,
  error: GLOBAL_TOAST_DURATION_MS,
}

export const TOAST_STACK_CAP = 4
