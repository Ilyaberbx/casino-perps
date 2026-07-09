import type { ReactNode } from 'react'
import { useLeverageMarginState } from './use-leverage-margin-state'
import { LeverageMarginContext } from './leverage-margin.context'

export function LeverageMarginProvider({ children }: { children: ReactNode }) {
  const state = useLeverageMarginState()

  return <LeverageMarginContext value={state}>{children}</LeverageMarginContext>
}
