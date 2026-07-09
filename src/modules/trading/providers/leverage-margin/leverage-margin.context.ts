import { createContext, useContext } from 'react'
import type { UseLeverageMarginReturn } from '../../components/leverage-margin/leverage-margin.types'

export const LeverageMarginContext = createContext<UseLeverageMarginReturn | null>(null)

/**
 * Shared leverage + margin-mode state for the selected market. Consumed by the
 * `LeverageMargin` badge/dialog AND by `use-order-entry` (its live `leverage`
 * drives the pre-trade estimates + buying-power sizing) — both MUST read the
 * same instance, or a leverage set on the badge never reaches order entry and
 * the order value silently sizes at 1× (the bug this provider exists to kill).
 */
export function useLeverageMargin(): UseLeverageMarginReturn {
  const context = useContext(LeverageMarginContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useLeverageMargin must be used within LeverageMarginProvider')
  }
  return context
}
