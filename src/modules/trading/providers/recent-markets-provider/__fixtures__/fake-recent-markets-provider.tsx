import type { ReactNode } from 'react'
import { RecentMarketsContext } from '../recent-markets-provider.context'
import type { RecentMarketsContextValue } from '../recent-markets-provider.types'

const defaultValue: RecentMarketsContextValue = {
  recentSymbols: [],
  recordMarketVisit: () => undefined,
}

interface FakeRecentMarketsProviderProps {
  children: ReactNode
  value?: Partial<RecentMarketsContextValue>
}

export function FakeRecentMarketsProvider({ children, value }: FakeRecentMarketsProviderProps) {
  const merged: RecentMarketsContextValue = { ...defaultValue, ...value }
  return <RecentMarketsContext value={merged}>{children}</RecentMarketsContext>
}
