import { createContext } from 'react'
import type { EvmCoreFlowContextValue } from './evm-core-flow-provider.types'

/**
 * Private to the provider unit. Carries the rich HL EVM⇄Core machine state plus
 * the reactive `isApplicable` flag. The body reads `flow` via `useEvmCoreFlow()`;
 * the generic host reads the thin port `EvmCoreState` through `useEvmCore()`
 * (`useHyperliquidEvmCore`), which projects from the same context value.
 */
export const EvmCoreFlowContext = createContext<EvmCoreFlowContextValue | null>(null)
