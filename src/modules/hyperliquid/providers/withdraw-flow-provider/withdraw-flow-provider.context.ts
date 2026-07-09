import { createContext } from 'react'
import type { WithdrawFlowContextValue } from './withdraw-flow-provider.types'

/**
 * Private to the provider unit. Carries the rich HL withdraw machine state plus
 * the reactive `isApplicable` flag. The body reads `flow` via `useWithdrawFlow()`;
 * the generic host reads the thin port `WithdrawState` through `useWithdraw()`
 * (`useHyperliquidWithdraw`), which projects from the same context value.
 */
export const WithdrawFlowContext = createContext<WithdrawFlowContextValue | null>(null)
