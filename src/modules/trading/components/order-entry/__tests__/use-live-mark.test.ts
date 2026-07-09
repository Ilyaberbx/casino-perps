import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as venueProvider from '../../../../shared/providers/venue-provider'
import type { MarketDataReader, Ticker } from '../../../../shared/domain'
import { useLiveMark } from '../use-live-mark'

const SYMBOL = 'BTC-PERP'

// useLiveMark streams the ticker through useAdapterStream, which coalesces
// notifications to one per animation frame (ADR-0043). Flush one rAF (inside act)
// before asserting the rendered value.
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

function perpTick(markPrice: number): Ticker {
  return {
    symbol: SYMBOL,
    marketType: 'perp',
    markPrice,
    open24h: 0,
    high24h: 0,
    low24h: 0,
    timestamp: 0,
    indexPrice: markPrice,
    openInterest: 0,
    fundingRate: 0,
    fundingCountdownSeconds: 0,
  }
}

function buildMarketData(
  subscribeTicker: MarketDataReader['subscribeTicker'],
): MarketDataReader {
  return {
    refresh: () => Promise.resolve(),
    listMarkets: () => [],
    subscribeMarkets: () => () => {},
    subscribeOrderbook: () => () => {},
    subscribeTrades: () => () => {},
    subscribeTicker,
  }
}

describe('useLiveMark', () => {
  // The fake ticker source captures the consumer callback so the test can drive
  // ticks; mirrors the structural ReconnectableSubscription fakes (no SDK mock).
  let emit: (ticker: Ticker) => void = () => {}
  const mockUnsubscribe = vi.fn()
  const mockSubscribeTicker = vi.fn<MarketDataReader['subscribeTicker']>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribeTicker.mockImplementation((_symbol, onTicker) => {
      emit = onTicker
      return mockUnsubscribe
    })
    vi.spyOn(venueProvider, 'useCapabilityOptional').mockReturnValue(
      buildMarketData(mockSubscribeTicker),
    )
  })

  it('seeds with the fallback before the first tick', () => {
    const { result } = renderHook(() => useLiveMark(SYMBOL, 100))
    expect(result.current).toBe(100)
  })

  it('updates the value the MID handler reads when a ticker tick arrives', async () => {
    const { result } = renderHook(() => useLiveMark(SYMBOL, 100))

    act(() => emit(perpTick(123.45)))
    await flushFrame()
    expect(result.current).toBe(123.45)

    act(() => emit(perpTick(130)))
    await flushFrame()
    expect(result.current).toBe(130)
  })

  it('subscribes to the selected symbol via the ticker capability', () => {
    renderHook(() => useLiveMark(SYMBOL, 0))
    expect(mockSubscribeTicker).toHaveBeenCalledTimes(1)
    expect(mockSubscribeTicker).toHaveBeenCalledWith(SYMBOL, expect.any(Function))
  })

  it('does not subscribe when the symbol is unresolved', () => {
    renderHook(() => useLiveMark('', 0))
    expect(mockSubscribeTicker).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useLiveMark(SYMBOL, 0))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('resubscribes to the new symbol on symbol change', () => {
    const { rerender } = renderHook(
      ({ symbol }: { symbol: string }) => useLiveMark(symbol, 0),
      { initialProps: { symbol: SYMBOL } },
    )

    rerender({ symbol: 'ETH-PERP' })
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    expect(mockSubscribeTicker).toHaveBeenCalledTimes(2)
    expect(mockSubscribeTicker).toHaveBeenLastCalledWith('ETH-PERP', expect.any(Function))
  })
})
