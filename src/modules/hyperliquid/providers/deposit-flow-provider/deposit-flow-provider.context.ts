import { createContext } from 'react'
import type { DepositFlowState } from './deposit-flow-provider.types'

/**
 * Private to the provider unit. Carries the rich HL deposit machine state to the
 * body via `useDepositFlow()`. The generic host never touches this — it reads
 * the thin port `DepositState` through `useDeposit()` instead.
 */
export const DepositFlowContext = createContext<DepositFlowState | null>(null)
