import { createContext } from 'react'
import type { SendFlowContextValue } from './send-flow-provider.types'

/**
 * Private to the provider unit. Carries the rich HL send machine state plus the
 * reactive `isApplicable` flag. The body reads `flow` via `useSendFlow()`; the
 * generic host reads the thin port `SendState` through `useSend()`
 * (`useHyperliquidSend`), which projects from the same context value.
 */
export const SendFlowContext = createContext<SendFlowContextValue | null>(null)
