import type { Market } from '@/modules/shared/domain'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'

/**
 * Derives a market row's type tag and display symbol. Replaces the inline
 * 4-way ternary in `MarketRow` with guard clauses (code-style rule 1):
 * - HIP-3 → dex short name tag (`xyz`), asset segment as the display symbol;
 * - spot → `SPOT`, pair as the display symbol;
 * - perp (or untyped) → max-leverage tag (`20x`), or `PERP` when no leverage,
 *   with the `-PERP` identity suffix stripped for display (`BTC-PERP` → `BTC`).
 */
export function deriveMarketRowTag(market: Market): { tagLabel: string; displaySymbol: string } {
  const isSpot = market.marketType === 'spot'
  const isHip3 = market.marketType === 'hip3'

  if (isHip3) {
    const { dexTag, displaySymbol } = parseHip3Symbol(market.symbol)
    return { tagLabel: dexTag, displaySymbol }
  }

  if (isSpot) {
    return { tagLabel: 'SPOT', displaySymbol: market.symbol }
  }

  const hasLeverage = market.maxLeverage !== undefined && market.maxLeverage > 0
  const leverageTag = hasLeverage ? `${market.maxLeverage}x` : 'PERP'
  return { tagLabel: leverageTag, displaySymbol: formatMarketDisplaySymbol(market.symbol) }
}
