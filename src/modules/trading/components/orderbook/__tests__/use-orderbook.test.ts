import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as venueProvider from '../../../../shared/providers/venue-provider'
import type { MarketDataReader, OrderbookUpdate } from '../../../../shared/domain'
import { useOrderbook } from '../use-orderbook'

const SYMBOL = 'BTC-PERP'

function snapshot(bestBid: number, bestAsk: number): OrderbookUpdate {
  return {
    kind: 'snapshot',
    symbol: SYMBOL,
    bids: [{ price: bestBid, size: 1 }],
    asks: [{ price: bestAsk, size: 1 }],
    sequence: 1,
    timestamp: 0,
  }
}

function buildMarketData(
  subscribeOrderbook: MarketDataReader['subscribeOrderbook'],
): MarketDataReader {
  return {
    refresh: () => Promise.resolve(),
    listMarkets: () => [],
    subscribeMarkets: () => () => {},
    subscribeOrderbook,
    subscribeTrades: () => () => {},
    subscribeTicker: () => () => {},
  }
}

describe('useOrderbook', () => {
  const mockUnsubscribe = vi.fn()
  const mockSubscribeOrderbook = vi.fn<MarketDataReader['subscribeOrderbook']>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribeOrderbook.mockReturnValue(mockUnsubscribe)
    vi.spyOn(venueProvider, 'useCapability').mockReturnValue(buildMarketData(mockSubscribeOrderbook))
  })

  it('calls unsubscribe when the symbol changes', () => {
    const { rerender } = renderHook(({ symbol }: { symbol: string }) => useOrderbook({ symbol, tick: 0, sizeAsset: 'base' }), {
      initialProps: { symbol: SYMBOL },
    })

    rerender({ symbol: 'ETH-PERP' })
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useOrderbook({ symbol: SYMBOL, tick: 0, sizeAsset: 'base' }))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('subscribes to new symbol after market change', () => {
    const { rerender } = renderHook(({ symbol }: { symbol: string }) => useOrderbook({ symbol, tick: 0, sizeAsset: 'base' }), {
      initialProps: { symbol: SYMBOL },
    })

    rerender({ symbol: 'ETH-PERP' })
    expect(mockSubscribeOrderbook).toHaveBeenCalledTimes(2)
    expect(mockSubscribeOrderbook).toHaveBeenLastCalledWith('ETH-PERP', expect.any(Function), { tick: 0 })
  })

  describe('mid + direction', () => {
    // Flush the useAdapterStream rAF-coalesced notification synchronously so a
    // fed snapshot re-renders the hook within the same act().
    const originalRaf = globalThis.requestAnimationFrame

    beforeEach(() => {
      globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
        cb(0)
        return 0
      }) as typeof globalThis.requestAnimationFrame
    })

    afterEach(() => {
      globalThis.requestAnimationFrame = originalRaf
    })

    function emit(update: OrderbookUpdate) {
      const onEvent = mockSubscribeOrderbook.mock.calls.at(-1)?.[1]
      if (onEvent === undefined) throw new Error('subscribe was not called')
      act(() => onEvent(update))
    }

    it('derives the mid as the best bid/ask midpoint', () => {
      const { result } = renderHook(() => useOrderbook({ symbol: SYMBOL, tick: 0, sizeAsset: 'base' }))
      emit(snapshot(100, 102))
      expect(result.current.mid).toBe(101)
    })

    it('flags an upward then downward mid tick', () => {
      const { result } = renderHook(() => useOrderbook({ symbol: SYMBOL, tick: 0, sizeAsset: 'base' }))

      emit(snapshot(100, 102))
      expect(result.current.midDirection).toBe('flat')

      emit(snapshot(101, 103))
      expect(result.current.mid).toBe(102)
      expect(result.current.midDirection).toBe('up')

      emit(snapshot(99, 101))
      expect(result.current.mid).toBe(100)
      expect(result.current.midDirection).toBe('down')
    })
  })
})
