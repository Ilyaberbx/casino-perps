import { createContext } from 'react'
import type { AccountModalContextValue } from './account-modal-provider.types'

export const AccountModalContext = createContext<AccountModalContextValue | null>(null)
