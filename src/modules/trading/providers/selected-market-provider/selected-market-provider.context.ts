import { createContext, useContext } from 'react'
import type { UseSelectedMarketProviderReturn } from './selected-market-provider.types'

export const SelectedMarketContext = createContext<UseSelectedMarketProviderReturn | null>(null)

export function useSelectedMarketContext(): UseSelectedMarketProviderReturn {
  const context = useContext(SelectedMarketContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useSelectedMarketContext must be used within SelectedMarketProvider')
  }
  return context
}
