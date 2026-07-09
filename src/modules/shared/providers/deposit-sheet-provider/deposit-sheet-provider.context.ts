import { createContext } from 'react'
import type { DepositSheetContextValue } from './deposit-sheet-provider.types'

export const DepositSheetContext = createContext<DepositSheetContextValue | null>(null)
