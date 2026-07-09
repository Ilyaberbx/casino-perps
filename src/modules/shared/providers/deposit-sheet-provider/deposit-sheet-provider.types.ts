import type { ReactNode } from 'react'

export interface DepositSheetContextValue {
  readonly isOpen: boolean
  open(): void
  close(): void
}

export interface DepositSheetProviderProps {
  readonly children: ReactNode
  readonly defaultOpen?: boolean
}
