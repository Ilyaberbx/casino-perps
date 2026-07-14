import { useCallback, useMemo, useState } from 'react'
import { createRecentMarketsStore } from '../../services/recent-markets-store'
import { recordRecentMarket } from '../../trading.utils'
import { RECENT_MARKETS_STORAGE_KEY, RECENT_MARKETS_LIMIT } from '../../trading.constants'
import type { MarketSymbol } from '../selected-market-provider'
import type { RecentMarketsContextValue } from './recent-markets-provider.types'

export function useRecentMarketsProvider(): RecentMarketsContextValue {
  const store = useMemo(() => createRecentMarketsStore(), [])

  const [recentSymbols, setRecentSymbols] = useState<ReadonlyArray<MarketSymbol>>(() => {
    const result = store.load(RECENT_MARKETS_STORAGE_KEY)
    return result.isOk() ? result.value.symbols : []
  })

  const recordMarketVisit = useCallback(
    (symbol: MarketSymbol) => {
      setRecentSymbols((current) => {
        // Load-bearing guard. The only caller is an effect in
        // `use-selected-market-provider` that re-runs on every venue market
        // snapshot, so it fires constantly for an unchanged symbol. Bailing when
        // the symbol is already the head makes those re-runs a true no-op — no
        // storage write, no re-render.
        const isAlreadyMostRecent = current[0] === symbol
        if (isAlreadyMostRecent) return current

        const next = recordRecentMarket(current, symbol, RECENT_MARKETS_LIMIT)
        store.save(RECENT_MARKETS_STORAGE_KEY, { version: 1, symbols: [...next] })
        return next
      })
    },
    [store],
  )

  return { recentSymbols, recordMarketVisit }
}
