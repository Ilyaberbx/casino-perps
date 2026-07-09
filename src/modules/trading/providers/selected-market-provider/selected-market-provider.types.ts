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
}
