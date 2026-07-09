import type { ReactNode } from 'react'

export interface AccountModalContextValue {
  readonly isOpen: boolean
  open(): void
  close(): void
}

export interface AccountModalProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
}
