import { createContext } from 'react'
import type { TransferFlowContextValue } from './transfer-flow-provider.types'

/**
 * Private to the provider unit. Carries the rich HL transfer machine state plus
 * the reactive `isApplicable` flag. The body reads `flow` via `useTransferFlow()`;
 * the generic host reads the thin port `TransferState` through `useTransfer()`
 * (`useHyperliquidTransfer`), which projects from the same context value.
 */
export const TransferFlowContext = createContext<TransferFlowContextValue | null>(null)
