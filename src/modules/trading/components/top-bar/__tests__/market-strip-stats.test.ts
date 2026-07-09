import { describe, it, expect } from 'vitest'
import { deriveMarketStripStats } from '../top-bar.utils'
import type { Market, Ticker, PerpTicker, SpotTicker } from '../../../../shared/domain/domain.types'

// stepSize 1e-5 → szDecimals 5 → perp decimal cap 1; a 5-digit price renders integer.
const PERP_MARKET = { stepSize: 1e-5, marketType: 'perp' } as Market
const HIP3_MARKET = { stepSize: 0.01, marketType: 'hip3' } as Market
const SPOT_MARKET = { stepSize: 0.01, marketType: 'spot' } as Market

const BASE_PERP: PerpTicker = {
  symbol: 'BTC-PERP',
  marketType: 'perp',
  markPrice: 50_000,
  indexPrice: 50_000,
  openInterest: 0,
  fundingRate: 0,
  fundingCountdownSeconds: 0,
  open24h: 48_000,
  high24h: 51_000,
  low24h: 47_000,
  timestamp: 0,
}

const BASE_HIP3: PerpTicker = {
  ...BASE_PERP,
  symbol: 'xyz:AAPL',
  marketType: 'hip3',
}

const BASE_SPOT: SpotTicker = {
  symbol: 'HYPE-SPOT',
  marketType: 'spot',
  markPrice: 12.34,
  open24h: 12,
  high24h: 13,
  low24h: 11,
  timestamp: 0,
}

const BASE_TICKER: Ticker = BASE_PERP

describe('deriveMarketStripStats — shared cells', () => {
  it('formats markPrice with thousands separator and magnitude-aware decimals', () => {
    const stats = deriveMarketStripStats(BASE_TICKER, PERP_MARKET)
    expect(stats.markPriceText).toBe('50,000')
  })

  it('signs positive 24h change with a plus and reports up direction', () => {
    const stats = deriveMarketStripStats(BASE_TICKER, PERP_MARKET)
    expect(stats.change24hText.startsWith('+')).toBe(true)
    expect(stats.change24hDirection).toBe('up')
  })

  it('signs negative 24h change with a minus and reports down direction', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, markPrice: 47_000 }, PERP_MARKET)
    expect(stats.change24hText.startsWith('-')).toBe(true)
    expect(stats.change24hDirection).toBe('down')
  })

  it('treats zero open24h as a flat up move (no division by zero)', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, open24h: 0 }, PERP_MARKET)
    expect(stats.change24hText).toBe('+0.00%')
    expect(stats.change24hDirection).toBe('up')
  })

  it('renders em dash for volume24hText when volume24h is undefined', () => {
    const stats = deriveMarketStripStats(BASE_TICKER, PERP_MARKET)
    expect(stats.volume24hText).toBe('—')
  })

  it('formats volume24h in compact USD when provided', () => {
    const stats = deriveMarketStripStats(BASE_TICKER, PERP_MARKET, 1_500_000_000)
    expect(stats.volume24hText).toBe('$1.50B')
  })

  it('renders a sub-cent asset with real digits, not a zeroed price', () => {
    // PUMP-like: stepSize 1 → szDecimals 0 → perp cap 6; a sub-cent price keeps digits.
    const subCentMarket = { stepSize: 1, marketType: 'perp' } as Market
    const stats = deriveMarketStripStats({ ...BASE_PERP, markPrice: 0.0017234 }, subCentMarket)
    expect(stats.markPriceText).toBe('0.001723')
  })
})

describe('deriveMarketStripStats — perp variant (full cell set)', () => {
  it('is discriminated as perp and carries oracle/openInterest/funding', () => {
    const stats = deriveMarketStripStats(BASE_PERP, PERP_MARKET)
    expect(stats.marketType).toBe('perp')
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.oraclePriceText).toBe('50,000')
  })

  it('formats openInterestText in compact USD', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, openInterest: 2_500_000 }, PERP_MARKET)
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.openInterestText).toBe('$2.50M')
  })

  it('formats positive fundingRate with plus sign and 4 decimals', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, fundingRate: 0.0001 }, PERP_MARKET)
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.fundingRateText).toBe('+0.0100%')
    expect(stats.fundingRateDirection).toBe('up')
  })

  it('formats negative fundingRate with minus sign and down direction', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, fundingRate: -0.0001 }, PERP_MARKET)
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.fundingRateText).toBe('-0.0100%')
    expect(stats.fundingRateDirection).toBe('down')
  })

  it('formats fundingCountdownText as MM:SS when under an hour', () => {
    const stats = deriveMarketStripStats({ ...BASE_PERP, fundingCountdownSeconds: 263 }, PERP_MARKET)
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.fundingCountdownText).toBe('04:23')
  })

  it('formats fundingCountdownText as HH:MM:SS when at least one hour', () => {
    const stats = deriveMarketStripStats(
      { ...BASE_PERP, fundingCountdownSeconds: 15791 },
      PERP_MARKET,
    )
    if (stats.marketType !== 'perp') throw new Error('expected perp variant')
    expect(stats.fundingCountdownText).toBe('04:23:11')
  })
})

describe('deriveMarketStripStats — hip3 variant (mark + oracle + 24h, no OI/funding)', () => {
  it('is discriminated as hip3 and carries oracle but structurally omits OI/funding', () => {
    const stats = deriveMarketStripStats({ ...BASE_HIP3, indexPrice: 250 }, HIP3_MARKET)
    expect(stats.marketType).toBe('hip3')
    if (stats.marketType !== 'hip3') throw new Error('expected hip3 variant')
    expect(stats.oraclePriceText).toBe('250')
    // No openInterestText / fundingRateText keys at all (omit, not dash).
    expect('openInterestText' in stats).toBe(false)
    expect('fundingRateText' in stats).toBe(false)
  })
})

describe('deriveMarketStripStats — spot variant (mark + 24h only, no oracle/OI/funding)', () => {
  it('is discriminated as spot and structurally omits oracle/OI/funding', () => {
    const stats = deriveMarketStripStats(BASE_SPOT, SPOT_MARKET, 5_000_000)
    expect(stats.marketType).toBe('spot')
    if (stats.marketType !== 'spot') throw new Error('expected spot variant')
    expect(stats.markPriceText).toBe('12.34')
    expect(stats.volume24hText).toBe('$5.00M')
    expect('oraclePriceText' in stats).toBe(false)
    expect('openInterestText' in stats).toBe(false)
    expect('fundingRateText' in stats).toBe(false)
  })
})
