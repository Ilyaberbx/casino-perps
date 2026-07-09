import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SelectedMarketContext } from '../../providers/selected-market-provider/selected-market-provider.context'
import type { Market } from '@/modules/shared/domain/domain.types'
import { useBookTradeControls } from '../use-book-trade-controls'

const WLD_LADDER = [0.00001, 0.00002, 0.00005, 0.0001, 0.001, 0.01]
const BTC_LADDER = [1, 2, 5, 10, 100, 1000]

function buildMarket(overrides: Partial<Market> = {}): Market {
  return {
    symbol: 'WLD-PERP',
    baseAsset: 'WLD',
    quoteAsset: 'USDC',
    venue: 'hyperliquid',
    tickSize: 0.0001,
    stepSize: 0.1,
    marketType: 'perp',
    hlCoin: 'WLD',
    ...overrides,
  }
}

function setupHook(initialMarket: Market) {
  const ref = { current: initialMarket }
  function Wrapper({ children }: { children: ReactNode }) {
    const value = {
      selectedMarket: ref.current.symbol,
      setSelectedMarket: vi.fn(),
      market: ref.current,
    }
    return (
      <SelectedMarketContext.Provider value={value}>{children}</SelectedMarketContext.Provider>
    )
  }
  const utils = renderHook(() => useBookTradeControls(), { wrapper: Wrapper })
  return {
    ...utils,
    setMarket(next: Market) {
      ref.current = next
      utils.rerender()
    },
  }
}

describe('useBookTradeControls', () => {
  it('exposes the HL 6-step ladder when markPrice is present, defaulting to ladder[3]', () => {
    const { result } = setupHook(buildMarket({ markPrice: 0.26 }))
    expect(result.current.tickLadder).toEqual(WLD_LADDER)
    expect(result.current.tick).toBe(0.0001)
  })

  it('falls back to the legacy ladder when markPrice is absent', () => {
    const { result } = setupHook(buildMarket({ tickSize: 0.01, markPrice: undefined }))
    expect(result.current.tickLadder).toEqual([0.01, 0.02, 0.05, 0.1, 1, 10])
  })

  it('resets tick when the ladder rebuilds and the prior selection is no longer in it', () => {
    const { result, setMarket } = setupHook(
      buildMarket({ symbol: 'WLD-PERP', tickSize: 0.01, markPrice: undefined }),
    )
    act(() => result.current.setTick(0.02))
    expect(result.current.tick).toBe(0.02)

    // markPrice arrives → ladder rebuilds; 0.02 not in the new ladder → reset to ladder[3].
    setMarket(buildMarket({ symbol: 'WLD-PERP', tickSize: 0.0001, markPrice: 0.26 }))
    expect(result.current.tickLadder).toEqual(WLD_LADDER)
    expect(result.current.tick).toBe(0.0001)
  })

  it('defaults bookSide to both', () => {
    const { result } = setupHook(buildMarket({ markPrice: 0.26 }))
    expect(result.current.bookSide).toBe('both')
  })

  it('symbol change resets tick, sizeAsset and bookSide to ladder[3] / base / both', () => {
    const { result, setMarket } = setupHook(
      buildMarket({ symbol: 'WLD-PERP', tickSize: 0.0001, markPrice: 0.26 }),
    )
    act(() => {
      result.current.setTick(0.01)
      result.current.setSizeAsset('quote')
      result.current.setBookSide('asks')
    })
    expect(result.current.tick).toBe(0.01)
    expect(result.current.sizeAsset).toBe('quote')
    expect(result.current.bookSide).toBe('asks')

    setMarket(buildMarket({ symbol: 'BTC-PERP', tickSize: 1, markPrice: 77726 }))
    expect(result.current.tickLadder).toEqual(BTC_LADDER)
    expect(result.current.tick).toBe(10)
    expect(result.current.sizeAsset).toBe('base')
    expect(result.current.bookSide).toBe('both')
  })
})
