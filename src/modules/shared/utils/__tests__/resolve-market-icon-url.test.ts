import { describe, it, expect } from 'vitest'
import {
  resolveMarketIconUrl,
  resolveTvIconUrl,
  resolveSpotBareIconUrl,
  resolveHlFallbackUrl,
  isCryptoMarket,
} from '../resolve-market-icon-url'
import type { IconResolution } from '../resolve-market-icon-url'
import { TRADINGVIEW_LOGOID_MAP } from '@/modules/shared/constants/tradingview-logoid-map.constants'
import type { Market } from '../../domain/domain.types'

const TV_BASE = 'https://s3-symbol-logo.tradingview.com'
const HL_BASE = 'https://app.hyperliquid.xyz/coins'
const LOGOIDS: Readonly<Record<string, string>> = TRADINGVIEW_LOGOID_MAP

// A crypto perp whose base asset has a TradingView logoid (BTC always does).
const BASE_PERP: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.1,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

// HIP-3 equity with a logoid (AAPL → 'apple'), sourced from TradingView.
const HIP3_AAPL: Market = {
  symbol: 'xyz:AAPL',
  baseAsset: 'AAPL',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.01,
  stepSize: 0.001,
  marketType: 'hip3',
  hlCoin: 'xyz:AAPL',
}

// HIP-3 market with no logoid — no HL crypto fallback for equities, so it goes
// straight to the letter placeholder.
const HIP3_UNKNOWN: Market = {
  ...HIP3_AAPL,
  symbol: 'xyz:UNKNOWN',
  baseAsset: 'ZZ_NOT_A_REAL_TICKER',
  hlCoin: 'xyz:UNKNOWN',
}

// Synthetic unmapped crypto perp — exercises the HL fallback + digit strip.
const UNMAPPED_PERP: Market = {
  ...BASE_PERP,
  symbol: 'ZZUNMAPPED2-PERP',
  baseAsset: 'ZZUNMAPPED',
  hlCoin: 'ZZUNMAPPED2',
}

// Synthetic unmapped k-prefix perp — HL fallback strips the k-multiplier.
const UNMAPPED_K_PERP: Market = {
  ...BASE_PERP,
  symbol: 'kZZBONK-PERP',
  baseAsset: 'kZZBONK',
  hlCoin: 'kZZBONK',
}

// Synthetic unmapped spot — exercises the HL paired + bare fallback shape.
const UNMAPPED_SPOT: Market = {
  symbol: 'ZZSPOT/USDC',
  baseAsset: 'ZZSPOT',
  quoteAsset: 'USDC',
  venue: 'hyperliquid',
  tickSize: 0.001,
  stepSize: 0.01,
  marketType: 'spot',
  hlCoin: '@999',
}

describe('resolveMarketIconUrl — crypto (Hyperliquid primary)', () => {
  it('resolves a crypto perp to its HL CDN URL (coin-correct, not TV XTVC)', () => {
    const result: IconResolution = resolveMarketIconUrl(BASE_PERP)
    expect(result.kind).toBe('hl')
    if (result.kind !== 'hl') throw new Error('expected hl')
    expect(result.url).toBe(`${HL_BASE}/BTC.svg`)
  })

  it('falls back to the HL CDN for an unmapped perp, stripping a re-listed trailing digit', () => {
    const result: IconResolution = resolveMarketIconUrl(UNMAPPED_PERP)
    expect(result.kind).toBe('hl')
    if (result.kind !== 'hl') throw new Error('expected hl')
    expect(result.url).toBe(`${HL_BASE}/ZZUNMAPPED.svg`)
  })

  it('strips a leading k-multiplier in the HL fallback (kZZBONK → ZZBONK.svg)', () => {
    const result: IconResolution = resolveMarketIconUrl(UNMAPPED_K_PERP)
    expect(result.kind).toBe('hl')
    if (result.kind !== 'hl') throw new Error('expected hl')
    expect(result.url).toBe(`${HL_BASE}/ZZBONK.svg`)
  })

  it('uses {BASE}_{QUOTE}.svg for a crypto spot market', () => {
    const result: IconResolution = resolveMarketIconUrl(UNMAPPED_SPOT)
    expect(result.kind).toBe('hl')
    if (result.kind !== 'hl') throw new Error('expected hl')
    expect(result.url).toBe(`${HL_BASE}/ZZSPOT_USDC.svg`)
  })
})

describe('resolveMarketIconUrl — HIP-3 (TradingView primary)', () => {
  it('resolves a HIP-3 equity to its TradingView logoid URL', () => {
    const result: IconResolution = resolveMarketIconUrl(HIP3_AAPL)
    expect(result.kind).toBe('tv')
    if (result.kind !== 'tv') throw new Error('expected tv')
    expect(result.url).toBe(`${TV_BASE}/${LOGOIDS.AAPL}.svg`)
  })
})

describe('resolveMarketIconUrl — placeholder', () => {
  it('returns placeholder for a HIP-3 market with no logoid (no HL fallback for equities)', () => {
    const result: IconResolution = resolveMarketIconUrl(HIP3_UNKNOWN)
    expect(result.kind).toBe('placeholder')
  })
})

describe('resolveTvIconUrl (crypto fallback / HIP-3 primary)', () => {
  it('returns the raw-symbol logoid URL for a mapped market', () => {
    expect(resolveTvIconUrl(BASE_PERP)).toBe(`${TV_BASE}/${LOGOIDS.BTC}.svg`)
  })

  it('falls back to the normalized stem for a suffixed base (ETH-PERP → ETH logoid)', () => {
    const legacyPerp: Market = { ...BASE_PERP, baseAsset: 'ETH-PERP', hlCoin: undefined }
    expect(resolveTvIconUrl(legacyPerp)).toBe(`${TV_BASE}/${LOGOIDS.ETH}.svg`)
  })

  it('returns null when no logoid is mapped', () => {
    expect(resolveTvIconUrl(HIP3_UNKNOWN)).toBeNull()
  })
})

describe('resolveHlFallbackUrl', () => {
  it('returns null for a HIP-3 market (no HL crypto icon for equities)', () => {
    expect(resolveHlFallbackUrl(HIP3_AAPL)).toBeNull()
  })

  it('returns the bare perp URL for a crypto perp', () => {
    expect(resolveHlFallbackUrl(BASE_PERP)).toBe(`${HL_BASE}/BTC.svg`)
  })
})

describe('resolveSpotBareIconUrl', () => {
  it('returns the bare {BASE}.svg for a spot market', () => {
    expect(resolveSpotBareIconUrl(UNMAPPED_SPOT)).toBe(`${HL_BASE}/ZZSPOT.svg`)
  })

  it('returns null for a non-spot market', () => {
    expect(resolveSpotBareIconUrl(BASE_PERP)).toBeNull()
  })
})

describe('isCryptoMarket', () => {
  it('is true for perp and spot markets', () => {
    expect(isCryptoMarket(BASE_PERP)).toBe(true)
    expect(isCryptoMarket(UNMAPPED_SPOT)).toBe(true)
  })

  it('is false for a HIP-3 market', () => {
    expect(isCryptoMarket(HIP3_AAPL)).toBe(false)
  })
})
