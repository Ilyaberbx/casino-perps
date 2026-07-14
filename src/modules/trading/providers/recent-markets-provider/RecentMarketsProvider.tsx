import { useRecentMarketsProvider } from './use-recent-markets-provider'
import { RecentMarketsContext } from './recent-markets-provider.context'
import type { RecentMarketsProviderProps } from './recent-markets-provider.types'

export function RecentMarketsProvider({ children }: RecentMarketsProviderProps) {
  const state = useRecentMarketsProvider()
  return <RecentMarketsContext value={state}>{children}</RecentMarketsContext>
}
