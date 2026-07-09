import type { Market } from '@/modules/shared/domain'
import type { MarketSymbol } from '../../providers/selected-market-provider'

export interface UseHotMarketsTickerReturn {
  /** True until the venue market universe has loaded (listMarkets() empty). */
  readonly isLoading: boolean
  /** Top markets by 24h volume, in a session-stable order. */
  readonly hotMarkets: Market[]
  /** The currently selected market symbol (for highlight), or null. */
  readonly activeSymbol: MarketSymbol | null
  /** Seconds for one full loop — scales with item count. */
  readonly marqueeDurationSec: number
  /** Navigate to /trade with the clicked market selected. */
  readonly onSelect: (symbol: MarketSymbol) => void
}

export interface HotMarketItemProps {
  readonly market: Market
  readonly isActive: boolean
  readonly onSelect: (symbol: MarketSymbol) => void
}
