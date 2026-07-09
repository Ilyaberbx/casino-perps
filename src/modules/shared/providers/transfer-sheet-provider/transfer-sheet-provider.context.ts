import { createContext } from 'react'
import type { TransferSheetContextValue } from './transfer-sheet-provider.types'

export const TransferSheetContext = createContext<TransferSheetContextValue | null>(null)
