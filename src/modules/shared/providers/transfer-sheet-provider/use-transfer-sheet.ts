import { useContext } from 'react'
import { TransferSheetContext } from './transfer-sheet-provider.context'
import type { TransferSheetContextValue } from './transfer-sheet-provider.types'

export function useTransferSheet(): TransferSheetContextValue {
  const ctx = useContext(TransferSheetContext)
  if (!ctx) {
    throw new Error('useTransferSheet must be used inside <TransferSheetProvider>')
  }
  return ctx
}
