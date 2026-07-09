import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Market } from '../../../../shared/domain/domain.types'
import * as selectedMarketModule from '../../../providers/selected-market-provider/selected-market-provider.context'
import { useBookTradesPanel } from '../use-book-trades-panel'

function buildMarket(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USDC',
    venue: 'hyperliquid',
    tickSize: 0.01,
    stepSize: 0.001,
    marketType: 'perp',
    hlCoin: 'BTC',
    ...overrides,
  }
}

function mockMarket(market: Market) {
  vi.spyOn(selectedMarketModule, 'useSelectedMarketContext').mockReturnValue({
    selectedMarket: market.symbol,
    setSelectedMarket: () => {},
    market,
  })
}

describe('useBookTradesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockMarket(buildMarket())
  })

  it('defaults to order-book tab', () => {
    const { result } = renderHook(() => useBookTradesPanel())
    expect(result.current.activeTab).toBe('order-book')
  })

  it('switches to trades on setActiveTab', () => {
    const { result } = renderHook(() => useBookTradesPanel())
    act(() => result.current.setActiveTab('trades'))
    expect(result.current.activeTab).toBe('trades')
  })

  it('switches back to order-book after toggling', () => {
    const { result } = renderHook(() => useBookTradesPanel())
    act(() => result.current.setActiveTab('trades'))
    act(() => result.current.setActiveTab('order-book'))
    expect(result.current.activeTab).toBe('order-book')
  })

  it('builds the fallback tickSize ladder when markPrice is absent, defaulting to ladder[3]', () => {
    const { result } = renderHook(() => useBookTradesPanel())
    expect(result.current.tickLadder).toEqual([0.01, 0.02, 0.05, 0.1, 1, 10])
    expect(result.current.tick).toBe(0.1)
  })

  it('defaults sizeAsset to base', () => {
    const { result } = renderHook(() => useBookTradesPanel())
    expect(result.current.sizeAsset).toBe('base')
    expect(result.current.baseSymbol).toBe('BTC')
    expect(result.current.quoteSymbol).toBe('USDC')
  })

  it('resets tick + sizeAsset when the market changes', () => {
    const { result, rerender } = renderHook(() => useBookTradesPanel())
    act(() => result.current.setTick(10))
    act(() => result.current.setSizeAsset('quote'))
    expect(result.current.tick).toBe(10)
    expect(result.current.sizeAsset).toBe('quote')

    mockMarket(buildMarket({ symbol: 'MON-PERP', baseAsset: 'MON', tickSize: 0.000001 }))
    rerender()

    // Default lands on ladder[3] = tickSize × 10 in the fallback (no markPrice) path.
    expect(result.current.tick).toBe(0.00001)
    expect(result.current.sizeAsset).toBe('base')
    expect(result.current.tickLadder[0]).toBe(0.000001)
  })
})
