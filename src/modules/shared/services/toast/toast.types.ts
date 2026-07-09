export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  readonly label: string
  readonly onClick: () => void
}

export interface ToastPayload {
  readonly variant: ToastVariant
  readonly title: string
  readonly description?: string
  readonly action?: ToastAction
  readonly durationMs?: number
  readonly id?: string
}

export interface ToastApi {
  show(payload: ToastPayload): string
  dismiss(id: string): void
  dismissAll(): void
}

export interface ToastRecord {
  readonly id: string
  readonly variant: ToastVariant
  readonly title: string
  readonly durationMs: number
  readonly description?: string
  readonly action?: ToastAction
  readonly createdAt: number
}

export type ToastQueueEvent =
  | { readonly kind: 'show'; readonly record: ToastRecord }
  | { readonly kind: 'dismiss'; readonly id: string }
  | { readonly kind: 'dismiss-all' }

export type ToastQueueListener = (event: ToastQueueEvent) => void
