import type { ReactNode } from 'react'
import type { MarketSymbol } from '../selected-market-provider'

export interface RecentMarketsContextValue {
  /** The markets the user has most recently opened, newest first, capped at
   *  `RECENT_MARKETS_LIMIT`. Raw stored symbols — the reader intersects them
   *  with the live universe, so a delisted symbol may still appear here. */
  recentSymbols: ReadonlyArray<MarketSymbol>
  /** Record a `/trade/:symbol` visit. Idempotent per symbol: re-visiting moves it
   *  to the front instead of duplicating it, and a repeat call with the symbol
   *  already at the front is a no-op (so it is safe to call from an effect). */
  recordMarketVisit: (symbol: MarketSymbol) => void
}

export interface RecentMarketsProviderProps {
  children: ReactNode
}
