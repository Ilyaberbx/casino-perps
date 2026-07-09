import { useContext } from 'react'
import { DepositSheetContext } from './deposit-sheet-provider.context'
import type { DepositSheetContextValue } from './deposit-sheet-provider.types'

export function useDepositSheet(): DepositSheetContextValue {
  const ctx = useContext(DepositSheetContext)
  if (!ctx) {
    throw new Error('useDepositSheet must be used inside <DepositSheetProvider>')
  }
  return ctx
}
