import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { Market } from '../../../../shared/domain/domain.types'
import * as selectedMarketModule from '../../../providers/selected-market-provider/selected-market-provider.context'
import { useMobileTabPanel } from '../use-mobile-tab-panel'
import { DEFAULT_MOBILE_TAB } from '../mobile-tab-panel.constants'

const MARKET: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USDC',
  venue: 'hyperliquid',
  tickSize: 0.01,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(selectedMarketModule, 'useSelectedMarketContext').mockReturnValue({
    selectedMarket: MARKET.symbol,
    setSelectedMarket: () => {},
    market: MARKET,
  })
})

describe('useMobileTabPanel', () => {
  it('starts on the default tab', () => {
    const { result } = renderHook(() => useMobileTabPanel())
    expect(result.current.activeTab).toBe(DEFAULT_MOBILE_TAB)
  })

  it('switches to the requested tab', () => {
    const { result } = renderHook(() => useMobileTabPanel())
    act(() => {
      result.current.setActiveTab('trades')
    })
    expect(result.current.activeTab).toBe('trades')
  })

  it('switches back to a previously visited tab', () => {
    const { result } = renderHook(() => useMobileTabPanel())
    act(() => {
      result.current.setActiveTab('orderbook')
    })
    act(() => {
      result.current.setActiveTab('chart')
    })
    expect(result.current.activeTab).toBe('chart')
  })
})
