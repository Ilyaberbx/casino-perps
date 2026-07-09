import { createContext } from 'react'
import type { DepositStatus } from './deposit-provider.types'

export type DepositState = {
  status: DepositStatus
  recheck: () => void
}

// Context is private to the provider unit — not exported from index.ts.
export const DepositContext = createContext<DepositState | null>(null)
