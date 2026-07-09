import type { Market } from '@/modules/shared/domain'
import { filterByMinVolume } from '../../trading.utils'
import { MIN_MARKET_VOLUME_USD } from '../../trading.constants'

/**
 * Picks the "hot" markets for the ticker: the top `limit` markets by 24h
 * notional volume, among those that clear the shared liquidity floor
 * (`MIN_MARKET_VOLUME_USD`). If nothing clears the floor (e.g. the mock venue's
 * tiny universe), it falls back to the top `limit` of all markets so the strip
 * never renders empty when markets exist.
 *
 * Pure function — no React, no I/O, no module state.
 */
export function pickHotMarkets(markets: Market[], limit: number): Market[] {
  const liquid = filterByMinVolume(markets, MIN_MARKET_VOLUME_USD)
  const pool = liquid.length > 0 ? liquid : markets
  const ranked = [...pool].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
  return ranked.slice(0, limit)
}
