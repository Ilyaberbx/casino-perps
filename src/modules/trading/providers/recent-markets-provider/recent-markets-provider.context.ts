import { createContext, useContext } from 'react'
import type { RecentMarketsContextValue } from './recent-markets-provider.types'

export const RecentMarketsContext = createContext<RecentMarketsContextValue | null>(null)

export function useRecentMarketsContext(): RecentMarketsContextValue {
  const context = useContext(RecentMarketsContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useRecentMarketsContext must be used within RecentMarketsProvider')
  }
  return context
}
