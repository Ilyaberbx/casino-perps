import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain/domain.types'
import { TRADINGVIEW_LOGOID_MAP } from '@/modules/shared/constants/tradingview-logoid-map.constants'
import { useAssetIcon } from '../use-asset-icon'

const TV_BASE = 'https://s3-symbol-logo.tradingview.com'
const HL_BASE = 'https://app.hyperliquid.xyz/coins'
const LOGOIDS: Readonly<Record<string, string>> = TRADINGVIEW_LOGOID_MAP

// Crypto perp — HL CDN primary (coin-correct), TradingView logoid fallback.
const BTC_PERP: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.1,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

// HIP-3 market with no logoid — no HL fallback, placeholder immediately.
const UNKNOWN_HIP3: Market = {
  symbol: 'xyz:NOPE',
  baseAsset: 'ZZ_NOPE',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.01,
  stepSize: 0.001,
  marketType: 'hip3',
  hlCoin: 'xyz:NOPE',
}

// Second perp for the market-change reset test.
const ETH_PERP: Market = {
  symbol: 'ETH-PERP',
  baseAsset: 'ETH',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.01,
  stepSize: 0.01,
  marketType: 'perp',
  hlCoin: 'ETH',
}

// HYPE — has a logoid and is in DARK_FILL_ICON_COINS.
const HYPE_SPOT: Market = {
  symbol: 'HYPE-SPOT',
  baseAsset: 'HYPE',
  quoteAsset: 'USD',
  venue: 'hyperliquid',
  tickSize: 0.001,
  stepSize: 0.01,
  marketType: 'spot',
  hlCoin: '@107',
}

// Unmapped spot — starts at the HL paired URL, falls back to the bare URL.
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

describe('useAssetIcon — src resolution', () => {
  it('returns the Hyperliquid src first for a crypto perp', () => {
    const { result } = renderHook(() => useAssetIcon(BTC_PERP))
    expect(result.current.src).toBe(`${HL_BASE}/BTC.svg`)
    expect(result.current.hasError).toBe(false)
    expect(result.current.isDarkFill).toBe(false)
    expect(typeof result.current.onError).toBe('function')
  })

  it('renders the placeholder immediately for a HIP-3 market with no logoid', () => {
    const { result } = renderHook(() => useAssetIcon(UNKNOWN_HIP3))
    expect(result.current.src).toBeNull()
    expect(result.current.hasError).toBe(true)
  })
})

describe('useAssetIcon — Hyperliquid → TradingView fallback', () => {
  it('falls from the HL crypto src to the TV logoid src on first error', () => {
    const { result } = renderHook(() => useAssetIcon(BTC_PERP))
    act(() => {
      result.current.onError()
    })
    expect(result.current.src).toBe(`${TV_BASE}/${LOGOIDS.BTC}.svg`)
    expect(result.current.hasError).toBe(false)
  })

  it('enters the placeholder state once both HL and TV have errored', () => {
    const { result } = renderHook(() => useAssetIcon(BTC_PERP))
    act(() => {
      result.current.onError()
    })
    act(() => {
      result.current.onError()
    })
    expect(result.current.hasError).toBe(true)
  })
})

describe('useAssetIcon — spot bare-icon fallback (unmapped spot)', () => {
  it('first attempt uses the paired URL', () => {
    const { result } = renderHook(() => useAssetIcon(UNMAPPED_SPOT))
    expect(result.current.src).toBe(`${HL_BASE}/ZZSPOT_USDC.svg`)
    expect(result.current.hasError).toBe(false)
  })

  it('on first onError swaps to the bare URL without entering error state', () => {
    const { result } = renderHook(() => useAssetIcon(UNMAPPED_SPOT))
    act(() => {
      result.current.onError()
    })
    expect(result.current.src).toBe(`${HL_BASE}/ZZSPOT.svg`)
    expect(result.current.hasError).toBe(false)
  })

  it('on second onError enters the placeholder state', () => {
    const { result } = renderHook(() => useAssetIcon(UNMAPPED_SPOT))
    act(() => {
      result.current.onError()
    })
    act(() => {
      result.current.onError()
    })
    expect(result.current.hasError).toBe(true)
  })
})

describe('useAssetIcon — market change resets the ladder', () => {
  it('resets to the first candidate when market.hlCoin changes', () => {
    let market = BTC_PERP
    const { result, rerender } = renderHook(() => useAssetIcon(market))

    act(() => {
      result.current.onError()
    })
    act(() => {
      result.current.onError()
    })
    expect(result.current.hasError).toBe(true)

    market = ETH_PERP
    rerender()

    expect(result.current.hasError).toBe(false)
    expect(result.current.src).toBe(`${HL_BASE}/ETH.svg`)
  })
})

describe('useAssetIcon — isDarkFill', () => {
  it('returns isDarkFill=true for HYPE (in DARK_FILL_ICON_COINS)', () => {
    const { result } = renderHook(() => useAssetIcon(HYPE_SPOT))
    expect(result.current.isDarkFill).toBe(true)
  })

  it('returns isDarkFill=false for BTC (not in DARK_FILL_ICON_COINS)', () => {
    const { result } = renderHook(() => useAssetIcon(BTC_PERP))
    expect(result.current.isDarkFill).toBe(false)
  })
})
