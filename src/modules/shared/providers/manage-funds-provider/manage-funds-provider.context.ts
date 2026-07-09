import { createContext } from 'react'
import type { ManageFundsContextValue } from './manage-funds-provider.types'

export const ManageFundsContext = createContext<ManageFundsContextValue | null>(null)
