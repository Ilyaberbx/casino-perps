import { useRecentMarketsContext } from './recent-markets-provider.context'
import type { RecentMarketsContextValue } from './recent-markets-provider.types'

export function useRecentMarkets(): RecentMarketsContextValue {
  return useRecentMarketsContext()
}
