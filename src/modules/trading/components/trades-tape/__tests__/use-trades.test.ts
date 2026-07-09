import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as venueProvider from '../../../../shared/providers/venue-provider'
import type { MarketDataReader } from '../../../../shared/domain'
import type { Trade, TradesUpdate } from '../../../../shared/domain/domain.types'
import type { WalletAddress } from '../../../../shared/domain/wallet-address'
import { useTrades } from '../use-trades'

const mockStartSpectating = vi.fn()
vi.mock('@/modules/spectate', () => ({
  useSpectate: () => ({
    spectatedAddress: null,
    isSpectating: false,
    startSpectating: mockStartSpectating,
    stopSpectating: vi.fn(),
  }),
}))

// useTrades streams through useAdapterStream, which coalesces notifications to one
// per animation frame (ADR-0043). The reducer still runs synchronously on every
// emit (dedupe/cap/order are unaffected); only the rendered snapshot lands next
// frame. Flush one rAF (inside act) before asserting rendered state.
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

const SYMBOL = 'BTC-PERP'
const TRADE_CAP = 100
const ADDRESS_A = '0x1111111111111111111111111111111111111111' as WalletAddress
const ADDRESS_B = '0x2222222222222222222222222222222222222222' as WalletAddress

function buildTrade(index: number): Trade {
  return {
    identifier: `trade-${index}`,
    symbol: SYMBOL,
    side: index % 2 === 0 ? 'buy' : 'sell',
    price: 65000 + index,
    size: 0.5,
    timestamp: 1_000_000 + index,
  }
}

function snapshot(trades: Trade[]): TradesUpdate {
  return { kind: 'snapshot', trades }
}

function append(trade: Trade): TradesUpdate {
  return { kind: 'append', trade }
}

function buildMarketData(subscribeTrades: MarketDataReader['subscribeTrades']): MarketDataReader {
  return {
    refresh: () => Promise.resolve(),
    listMarkets: () => [],
    subscribeMarkets: () => () => {},
    subscribeOrderbook: () => () => {},
    subscribeTrades,
    subscribeTicker: () => () => {},
  }
}

describe('useTrades', () => {
  const mockUnsubscribe = vi.fn()
  const mockSubscribeTrades = vi.fn<MarketDataReader['subscribeTrades']>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSubscribeTrades.mockReturnValue(mockUnsubscribe)
    vi.spyOn(venueProvider, 'useCapability').mockReturnValue(buildMarketData(mockSubscribeTrades))
  })

  it('starts in a loading state with no trades until the first snapshot', () => {
    const { result } = renderHook(() => useTrades(SYMBOL))
    expect(result.current.isLoading).toBe(true)
    expect(result.current.trades).toHaveLength(0)
  })

  it('flips out of loading on the snapshot and shows its trades in one step', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot([buildTrade(2), buildTrade(1)]))
    })
    await flushFrame()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.trades.map((t) => t.identifier)).toEqual(['trade-2', 'trade-1'])
  })

  it('treats an empty snapshot as ready, not loading', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot([]))
    })
    await flushFrame()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.trades).toHaveLength(0)
  })

  it('caps a large snapshot to TRADE_CAP items', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot(Array.from({ length: TRADE_CAP + 10 }, (_unused, index) => buildTrade(index))))
    })
    await flushFrame()

    expect(result.current.trades).toHaveLength(TRADE_CAP)
  })

  it('appends incoming trades newest at index 0', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot([]))
      emit?.(append(buildTrade(1)))
      emit?.(append(buildTrade(2)))
    })
    await flushFrame()

    expect(result.current.trades[0].identifier).toBe('trade-2')
    expect(result.current.trades[1].identifier).toBe('trade-1')
  })

  it('dedupes an appended trade that shares an identifier (Hyperliquid two-sided fills)', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    const first = buildTrade(1)
    const secondSideOfSameMatch: Trade = { ...first, side: 'buy' }

    act(() => {
      emit?.(snapshot([]))
      emit?.(append(first))
      emit?.(append(secondSideOfSameMatch))
    })
    await flushFrame()

    expect(result.current.trades).toHaveLength(1)
    expect(result.current.trades[0].side).toBe(first.side)
  })

  it('dedupes a snapshot that carries the same identifier twice (Hyperliquid two-sided fills)', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    const buy = buildTrade(1)
    const sellSideOfSameMatch: Trade = { ...buy, side: 'sell' }

    act(() => {
      emit?.(snapshot([buy, sellSideOfSameMatch, buildTrade(2)]))
    })
    await flushFrame()

    const identifiers = result.current.trades.map((t) => t.identifier)
    expect(identifiers).toEqual(['trade-1', 'trade-2'])
    expect(identifiers.filter((id) => id === 'trade-1')).toHaveLength(1)
  })

  it('dedupes a duplicate appended id anywhere in the retained window', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot([]))
      emit?.(append(buildTrade(1)))
      for (let index = 2; index <= 20; index++) emit?.(append(buildTrade(index)))
      emit?.(append(buildTrade(1))) // same identifier, 19 trades later
    })
    await flushFrame()

    expect(result.current.trades).toHaveLength(20)
    expect(result.current.trades.filter((t) => t.identifier === 'trade-1')).toHaveLength(1)
  })

  it('caps the in-memory list to TRADE_CAP items (FIFO, oldest dropped)', async () => {
    let emit: ((update: TradesUpdate) => void) | undefined
    mockSubscribeTrades.mockImplementation((_symbol, onUpdate) => {
      emit = onUpdate
      return mockUnsubscribe
    })

    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      emit?.(snapshot([]))
      for (let index = 0; index < TRADE_CAP + 10; index++) {
        emit?.(append(buildTrade(index)))
      }
    })
    await flushFrame()

    expect(result.current.trades).toHaveLength(TRADE_CAP)
    expect(result.current.trades[0].identifier).toBe(`trade-${TRADE_CAP + 9}`)
  })

  it('calls unsubscribe when the symbol changes', () => {
    const { rerender } = renderHook(({ symbol }: { symbol: string }) => useTrades(symbol), {
      initialProps: { symbol: SYMBOL },
    })

    rerender({ symbol: 'ETH-PERP' })
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useTrades(SYMBOL))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('starts with no hovered address', () => {
    const { result } = renderHook(() => useTrades(SYMBOL))
    expect(result.current.hoveredAddress).toBeNull()
  })

  it('hoverAddress sets the hovered address and leaveAddress clears it', () => {
    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      result.current.hoverAddress(ADDRESS_A)
    })
    expect(result.current.hoveredAddress).toBe(ADDRESS_A)

    act(() => {
      result.current.leaveAddress()
    })
    expect(result.current.hoveredAddress).toBeNull()
  })

  it('spectateAddress forwards the address to startSpectating', () => {
    const { result } = renderHook(() => useTrades(SYMBOL))

    act(() => {
      result.current.spectateAddress(ADDRESS_B)
    })
    expect(mockStartSpectating).toHaveBeenCalledWith(ADDRESS_B)
  })
})
