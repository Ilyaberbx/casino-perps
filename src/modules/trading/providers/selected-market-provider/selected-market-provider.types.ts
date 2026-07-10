import type { ReactNode } from 'react'
import type { Market } from '../../../shared/domain/domain.types'

/**
 * A routable HL market symbol in one of three forms:
 *  - Perp:  `BTC-PERP`, `ETH-PERP`   (uppercase base + `-PERP`)
 *  - Spot:  `HYPE/USDC`, `PURR/USDC` (exchange-native `BASE/QUOTE` pair)
 *  - HIP-3: `xyz:AAPL`, `XYZ:XYZ100` (dex + `:` + asset; see ADR-0016)
 * Validated structurally via `isMarketSymbol`; not pinned to a whitelist.
 */
export type MarketSymbol = string

export interface UseSelectedMarketProviderReturn {
  selectedMarket: MarketSymbol
  setSelectedMarket: (market: MarketSymbol) => void
  /**
   * The resolved domain `Market` for `selectedMarket`, carrying `hlCoin` /
   * `marketType` / `hasCandles`. Resolved once here (from the venue's
   * `listMarkets()`/`subscribeMarkets`) so every panel consumes the same
   * `Market` instead of re-deriving it. URL/storage still persist only the
   * `selectedMarket` STRING — the `Market` object is never persisted.
   */
  market: Market
}

export interface SelectedMarketProviderProps {
  children: ReactNode
  /**
   * Seed the selected market from the route path (`/trade/:symbol`, PRD 0008
   * D15). When provided, the path becomes the URL source of truth: the provider
   * adopts inbound path changes and STOPS managing the legacy `?market=` query.
   * When omitted (undefined), the provider keeps its original query-driven
   * behaviour unchanged — deep links, storage, and the default all still apply.
   */
  initialSymbol?: string
}
