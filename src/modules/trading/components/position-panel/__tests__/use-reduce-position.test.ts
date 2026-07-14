import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import type {
  PerpPositionSnapshot,
  PlaceOrderRequest,
  Trader,
  Venue,
} from '@/modules/shared/domain'
import { useReducePosition } from '../use-reduce-position'

const FILLED = {
  kind: 'filled' as const,
  orderIdentifier: 'r1',
  symbol: 'BTC-PERP',
  averagePrice: 100,
  filledSize: 1,
  timestamp: 1,
}

function position(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 2,
    entryPrice: 100,
    markPrice: 110,
    positionValueUsd: 220,
    unrealizedPnlUsd: 20,
    roePct: 10,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 91,
    marginUsedUsd: 22,
    ...overrides,
  }
}

function render(placeOrder: Trader['placeOrder'], pos = position(), onDone = vi.fn()) {
  const venue = {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      trader: { placeOrder, cancelOrder: () => okAsync(undefined) },
    },
  } as unknown as Venue
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(VenueContext.Provider, { value: venue }, children)
  return renderHook(() => useReducePosition(pos, onDone), { wrapper })
}

describe('useReducePosition', () => {
  it('defaults to a market reduce of half the position', () => {
    const { result } = render(vi.fn(() => okAsync(FILLED)))
    expect(result.current.mode).toBe('market')
    expect(result.current.fraction).toBe(0.5)
    expect(result.current.size).toBe(1) // half of an open size of 2
    expect(result.current.openSize).toBe(2)
  })

  it('resolves the fraction to a coin size, clamped to the open position', () => {
    const { result } = render(vi.fn(() => okAsync(FILLED)))
    act(() => result.current.setFraction(0.25))
    expect(result.current.size).toBe(0.5)
    act(() => result.current.setFraction(1))
    expect(result.current.size).toBe(2)
  })

  it('sends a reduce-only market order on the opposite side', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render(placeOrder)

    act(() => result.current.setFraction(0.5))
    act(() => result.current.submit())

    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'BTC-PERP',
      side: 'sell', // closing a long
      size: 1,
      reduceOnly: true,
    })
  })

  it('closes a short with a reduce-only buy', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render(placeOrder, position({ side: 'short' }))
    act(() => result.current.submit())
    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({ side: 'buy', reduceOnly: true })
  })

  it('rests a reduce-only limit at the given price', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render(placeOrder)

    act(() => result.current.setMode('limit'))
    act(() => result.current.setLimitPriceInput('120'))
    act(() => result.current.submit())

    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({
      orderType: 'limit',
      price: 120,
      reduceOnly: true,
      timeInForce: 'Gtc',
    })
  })

  it('cannot submit a limit reduce with no price', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render(placeOrder)
    act(() => result.current.setMode('limit'))
    expect(result.current.isPriceValid).toBe(false)
    expect(result.current.canSubmit).toBe(false)
    act(() => result.current.submit())
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('prefills the limit price from the mark', () => {
    const { result } = render(vi.fn(() => okAsync(FILLED)))
    act(() => result.current.setMode('limit'))
    act(() => result.current.useMarkPrice())
    expect(result.current.limitPriceInput).toBe('110')
    expect(result.current.isPriceValid).toBe(true)
  })

  it('cannot submit a zero-size reduce', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render(placeOrder)
    act(() => result.current.setFraction(0))
    expect(result.current.size).toBe(0)
    expect(result.current.canSubmit).toBe(false)
  })
})
