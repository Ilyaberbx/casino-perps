import { useContext } from 'react'
import { ManageFundsContext } from './manage-funds-provider.context'
import type { ManageFundsContextValue } from './manage-funds-provider.types'

export function useManageFunds(): ManageFundsContextValue {
  const ctx = useContext(ManageFundsContext)
  if (!ctx) {
    throw new Error('useManageFunds must be used inside <ManageFundsProvider>')
  }
  return ctx
}
