import type { Market } from '@/modules/shared/domain/domain.types'

/**
 * Factory for a perp market with sensible defaults.
 * Accepts Partial<Market> overrides to customize individual fields.
 */
export function buildPerpMarket(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'Bitcoin',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 0.1,
    stepSize: 0.001,
    marketType: 'perp',
    markPrice: 50000,
    change24hPct: 2.5,
    volume24h: 1_000_000,
    ...overrides,
  }
}

/**
 * Factory for a spot market with sensible defaults.
 * Accepts Partial<Market> overrides to customize individual fields.
 */
export function buildSpotMarket(overrides: Partial<Market> = {}): Market {
  return buildPerpMarket({
    symbol: 'ETH-SPOT',
    baseAsset: 'Ethereum',
    marketType: 'spot',
    markPrice: 3000,
    change24hPct: 1.2,
    volume24h: 500_000,
    ...overrides,
  })
}

/**
 * Factory for a HIP-3 market with sensible defaults.
 * Default symbol 'xyz:AAPL', base asset 'Apple Inc.'.
 * Accepts Partial<Market> overrides to customize individual fields.
 */
export function buildHip3Market(overrides: Partial<Market> = {}): Market {
  return buildPerpMarket({
    symbol: 'xyz:AAPL',
    baseAsset: 'Apple Inc.',
    marketType: 'hip3',
    markPrice: 185.5,
    change24hPct: -0.8,
    volume24h: 150_000,
    ...overrides,
  })
}
