import { describe, it, expect } from 'vitest'
import {
  filterByCategory,
  filterBySearch,
  sortByPill,
  collectIconWarmUrls,
} from '../market-selection-window.utils'
import {
  buildPerpMarket,
  buildSpotMarket,
  buildHip3Market,
} from '../__fixtures__/fake-markets'
import { TRADINGVIEW_LOGOID_MAP } from '@/modules/shared/constants/tradingview-logoid-map.constants'

describe('filterByCategory', () => {
  describe('asset-class tab routing (Minara 1:1, ADR-0062)', () => {
    it('returns all markets when tab is "all"', () => {
      const markets = [
        buildPerpMarket({ baseAsset: 'BTC' }),
        buildSpotMarket({ baseAsset: 'ETH' }),
      ]
      expect(filterByCategory(markets, 'all')).toHaveLength(2)
    })

    it('routes a stock (AAPL HIP-3) to "stocks" and crypto to "crypto"', () => {
      const markets = [
        buildHip3Market({ symbol: 'xyz:AAPL', baseAsset: 'AAPL' }),
        buildSpotMarket({ symbol: 'ETH/USDC', baseAsset: 'ETH' }),
      ]
      expect(filterByCategory(markets, 'stocks').map((m) => m.baseAsset)).toEqual(['AAPL'])
      expect(filterByCategory(markets, 'crypto').map((m) => m.baseAsset)).toEqual(['ETH'])
    })

    it('routes a commodity (GOLD) to "commodities"', () => {
      const markets = [
        buildPerpMarket({ baseAsset: 'GOLD' }),
        buildPerpMarket({ baseAsset: 'BTC' }),
      ]
      expect(filterByCategory(markets, 'commodities').map((m) => m.baseAsset)).toEqual([
        'GOLD',
      ])
    })

    it('keeps spot crypto markets (folded into "crypto", never dropped)', () => {
      const markets = [buildSpotMarket({ baseAsset: 'SOL' })]
      expect(filterByCategory(markets, 'crypto')).toHaveLength(1)
    })
  })
})

describe('filterBySearch', () => {
  describe('SEL-04: case-insensitive substring search', () => {
    it('returns all markets when query is empty (06-01-T2f)', () => {
      const markets = [buildPerpMarket(), buildSpotMarket()]
      expect(filterBySearch(markets, '')).toHaveLength(2)
    })

    it('returns only BTC markets for query "btc" — case-insensitive (06-01-T2e)', () => {
      const markets = [
        buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'Bitcoin' }),
        buildSpotMarket({ symbol: 'ETH-SPOT', baseAsset: 'Ethereum' }),
      ]
      const result = filterBySearch(markets, 'btc')
      expect(result).toHaveLength(1)
      expect(result[0].symbol).toBe('BTC-PERP')
    })

    it('matches on baseAsset substring', () => {
      const markets = [
        buildPerpMarket({ symbol: 'ETH-PERP', baseAsset: 'Ethereum' }),
        buildSpotMarket({ symbol: 'BTC-SPOT', baseAsset: 'Bitcoin' }),
      ]
      const result = filterBySearch(markets, 'ethe')
      expect(result).toHaveLength(1)
      expect(result[0].symbol).toBe('ETH-PERP')
    })

    it('is case-insensitive on both symbol and baseAsset', () => {
      const markets = [buildPerpMarket({ symbol: 'BTC-PERP', baseAsset: 'Bitcoin' })]
      expect(filterBySearch(markets, 'BTC')).toHaveLength(1)
      expect(filterBySearch(markets, 'bitcoin')).toHaveLength(1)
      expect(filterBySearch(markets, 'BITCOIN')).toHaveLength(1)
    })
  })
})

describe('sortByPill', () => {
  describe('SEL-02: category pill sorting', () => {
    it('sortByPill("popular") puts POPULAR_ORDER symbols first (06-01-T2d)', () => {
      const markets = [
        buildPerpMarket({ symbol: 'LINK-PERP', volume24h: 999_999 }),
        buildPerpMarket({ symbol: 'BTC-PERP', volume24h: 100 }),
        buildPerpMarket({ symbol: 'ETH-PERP', volume24h: 100 }),
      ]
      const result = sortByPill(markets, 'popular')
      expect(result[0].symbol).toBe('BTC-PERP')
      expect(result[1].symbol).toBe('ETH-PERP')
      expect(result[2].symbol).toBe('LINK-PERP')
    })

    it('sortByPill("popular") tie-breaks POPULAR_ORDER-unlisted markets by volume desc — spot (ADR-0017)', () => {
      const markets = [
        buildSpotMarket({ symbol: 'LOW/USDC', volume24h: 1_000 }),
        buildSpotMarket({ symbol: 'HIGH/USDC', volume24h: 9_000_000 }),
        buildSpotMarket({ symbol: 'MID/USDC', volume24h: 50_000 }),
      ]
      const result = sortByPill(markets, 'popular')
      expect(result.map((m) => m.symbol)).toEqual(['HIGH/USDC', 'MID/USDC', 'LOW/USDC'])
    })

    it('sortByPill("hot") orders by volume24h descending (06-01-T2a)', () => {
      const markets = [
        buildPerpMarket({ symbol: 'LOW-PERP', volume24h: 100 }),
        buildPerpMarket({ symbol: 'HIGH-PERP', volume24h: 999_999 }),
        buildPerpMarket({ symbol: 'MID-PERP', volume24h: 50_000 }),
      ]
      const result = sortByPill(markets, 'hot')
      expect(result[0].symbol).toBe('HIGH-PERP')
      expect(result[1].symbol).toBe('MID-PERP')
      expect(result[2].symbol).toBe('LOW-PERP')
    })

    it('sortByPill("gainers") orders by change24hPct descending (06-01-T2b)', () => {
      const markets = [
        buildPerpMarket({ symbol: 'NEG-PERP', change24hPct: -5 }),
        buildPerpMarket({ symbol: 'BIG-PERP', change24hPct: 20 }),
        buildPerpMarket({ symbol: 'SMALL-PERP', change24hPct: 3 }),
      ]
      const result = sortByPill(markets, 'gainers')
      expect(result[0].symbol).toBe('BIG-PERP')
      expect(result[1].symbol).toBe('SMALL-PERP')
      expect(result[2].symbol).toBe('NEG-PERP')
    })

    it('sortByPill("losers") orders by change24hPct ascending (most negative first) (06-01-T2c)', () => {
      const markets = [
        buildPerpMarket({ symbol: 'POS-PERP', change24hPct: 5 }),
        buildPerpMarket({ symbol: 'WORST-PERP', change24hPct: -20 }),
        buildPerpMarket({ symbol: 'BAD-PERP', change24hPct: -3 }),
      ]
      const result = sortByPill(markets, 'losers')
      expect(result[0].symbol).toBe('WORST-PERP')
      expect(result[1].symbol).toBe('BAD-PERP')
      expect(result[2].symbol).toBe('POS-PERP')
    })

    it('does not mutate the input array', () => {
      const markets = [buildPerpMarket({ symbol: 'A-PERP' }), buildPerpMarket({ symbol: 'B-PERP' })]
      const original = [...markets]
      sortByPill(markets, 'hot')
      expect(markets[0].symbol).toBe(original[0].symbol)
    })
  })
})

describe('collectIconWarmUrls', () => {
  const HL = 'https://app.hyperliquid.xyz/coins'
  const TV = 'https://s3-symbol-logo.tradingview.com'
  const LOGOIDS: Readonly<Record<string, string>> = TRADINGVIEW_LOGOID_MAP

  it('yields the HL composite primary AND the HL bare fallback for a crypto spot market', () => {
    const urls = collectIconWarmUrls([buildSpotMarket({ baseAsset: 'ZEC', quoteAsset: 'USDC' })])
    expect(urls).toContain(`${HL}/ZEC_USDC.svg`)
    expect(urls).toContain(`${HL}/ZEC.svg`)
  })

  it('yields one HL URL for a crypto perp market (no bare fallback)', () => {
    const urls = collectIconWarmUrls([buildPerpMarket({ baseAsset: 'BTC', hlCoin: 'BTC' })])
    expect(urls).toEqual([`${HL}/BTC.svg`])
  })

  it('yields the TradingView URL for a hip3 market (HL has no equity icon)', () => {
    const urls = collectIconWarmUrls([buildHip3Market({ baseAsset: 'AAPL' })])
    expect(urls).toEqual([`${TV}/${LOGOIDS.AAPL}.svg`])
  })

  it('de-duplicates repeated markets', () => {
    const market = buildPerpMarket({ baseAsset: 'BTC', hlCoin: 'BTC' })
    expect(collectIconWarmUrls([market, market])).toEqual([`${HL}/BTC.svg`])
  })

  it('orders spot URLs before perp and hip3 URLs', () => {
    const urls = collectIconWarmUrls([
      buildPerpMarket({ baseAsset: 'BTC', hlCoin: 'BTC' }),
      buildSpotMarket({ baseAsset: 'ZEC', quoteAsset: 'USDC' }),
      buildHip3Market({ baseAsset: 'AAPL' }),
    ])
    const spotIndex = urls.indexOf(`${HL}/ZEC_USDC.svg`)
    const perpIndex = urls.indexOf(`${HL}/BTC.svg`)
    const hip3Index = urls.indexOf(`${TV}/${LOGOIDS.AAPL}.svg`)
    expect(spotIndex).toBeGreaterThanOrEqual(0)
    expect(spotIndex).toBeLessThan(perpIndex)
    expect(spotIndex).toBeLessThan(hip3Index)
  })
})
