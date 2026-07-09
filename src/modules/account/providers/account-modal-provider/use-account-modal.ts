import { useContext } from 'react'
import { AccountModalContext } from './account-modal-provider.context'
import type { AccountModalContextValue } from './account-modal-provider.types'

export function useAccountModal(): AccountModalContextValue {
  const ctx = useContext(AccountModalContext)
  if (!ctx) {
    throw new Error('useAccountModal must be used inside <AccountModalProvider>')
  }
  return ctx
}
