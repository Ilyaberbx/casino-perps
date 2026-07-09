import type { Market, Ticker } from '../../../shared/domain/domain.types'
import type { MarketHeaderLabel, MarketStripStats } from './top-bar.types'
import { formatCompactUsd } from '../../trading.utils'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import { formatMarketDisplaySymbol } from '@/modules/shared/utils/format-market-display-symbol'
import { parseHip3Symbol } from '@/modules/shared/utils/hip3-symbol'

const SECONDS_PER_HOUR = 3600

/**
 * Derives the market-header trigger label from the resolved `Market`, consistent
 * with the selector rows (LOCKED DECISION c): perp/spot show the display symbol
 * with the `-PERP` identity suffix stripped (`BTC-PERP` → `BTC`); HIP-3 shows the
 * bare asset segment plus a `dexTag` badge (`xyz:NVDA` → `NVDA` + `XYZ`). The
 * routing symbol (`selectedMarket`) is untouched — this is a render-edge label.
 */
export function deriveMarketHeaderLabel(market: Market): MarketHeaderLabel {
  const isHip3 = market.marketType === 'hip3'
  if (isHip3) {
    const { dexTag, displaySymbol } = parseHip3Symbol(market.symbol)
    return { label: displaySymbol, dexTag }
  }
  return { label: formatMarketDisplaySymbol(market.symbol), dexTag: null }
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(2)}%`
}

function formatFundingRate(rate: number): string {
  const isPositive = rate >= 0
  const sign = isPositive ? '+' : '-'
  return `${sign}${(Math.abs(rate) * 100).toFixed(4)}%`
}

function formatCountdown(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, totalSeconds)
  const hasHours = clampedSeconds >= SECONDS_PER_HOUR
  if (hasHours) {
    const hours = Math.floor(clampedSeconds / SECONDS_PER_HOUR)
    const minutes = Math.floor((clampedSeconds % SECONDS_PER_HOUR) / 60)
    const seconds = clampedSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  const minutes = Math.floor(clampedSeconds / 60)
  const seconds = clampedSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Derives the per-market-type market strip stats from a domain `Ticker`.
 *
 * The `Ticker` union is discriminated on `marketType` (D-04). The returned
 * `MarketStripStats` is itself a discriminated union (D-02/D-02a): the cells
 * that a market type structurally lacks are **absent** from the returned
 * shape, not dashed/zeroed. `TickerStats` renders only the cells the variant
 * carries. Cell matrix (UI-SPEC §2, binding):
 *  - spot  → Mark + 24h Change + 24h Volume
 *  - hip3  → + Oracle/Index
 *  - perp  → + Oracle/Index + Open Interest + Funding/Countdown
 */
export function deriveMarketStripStats(
  ticker: Ticker,
  market: Market,
  volume24h?: number,
): MarketStripStats {
  const priceSpec = specFromMarket(market)
  const hasOpen = ticker.open24h > 0
  const change24h = hasOpen ? (ticker.markPrice - ticker.open24h) / ticker.open24h : 0
  const change24hDirection: 'up' | 'down' = change24h >= 0 ? 'up' : 'down'

  const markPriceText = formatPrice(ticker.markPrice, priceSpec)
  const change24hText = formatPercent(change24h)
  const volume24hText = volume24h !== undefined ? formatCompactUsd(volume24h) : '—'

  const base = { markPriceText, change24hText, change24hDirection, volume24hText }

  const isSpot = ticker.marketType === 'spot'
  if (isSpot) {
    return { marketType: 'spot', ...base }
  }

  const oraclePriceText = formatPrice(ticker.indexPrice, priceSpec)

  const isHip3 = ticker.marketType === 'hip3'
  if (isHip3) {
    return { marketType: 'hip3', ...base, oraclePriceText }
  }

  const fundingRateDirection: 'up' | 'down' = ticker.fundingRate >= 0 ? 'up' : 'down'
  const openInterestText = formatCompactUsd(ticker.openInterest)
  const fundingRateText = formatFundingRate(ticker.fundingRate)
  const fundingCountdownText = formatCountdown(ticker.fundingCountdownSeconds)

  return {
    marketType: 'perp',
    ...base,
    oraclePriceText,
    openInterestText,
    fundingRateText,
    fundingRateDirection,
    fundingCountdownText,
  }
}
