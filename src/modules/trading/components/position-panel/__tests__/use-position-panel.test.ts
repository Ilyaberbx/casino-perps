import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { okAsync, errAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { CancelOrderError, parseWalletAddress } from '@/modules/shared/domain'
import type {
  Market,
  Order,
  PerpPositionSnapshot,
  PlaceOrderRequest,
  Trader,
  Venue,
} from '@/modules/shared/domain'
import { usePositionPanel } from '../use-position-panel'

const MARKET: Market = {
  symbol: 'BTC-PERP',
  baseAsset: 'BTC',
  quoteAsset: 'USD',
  venue: 'mock',
  tickSize: 0.5,
  stepSize: 0.001,
  marketType: 'perp',
  hlCoin: 'BTC',
}

const FILLED = {
  kind: 'filled' as const,
  orderIdentifier: 'c1',
  symbol: 'BTC-PERP',
  averagePrice: 70_000,
  filledSize: 0.5,
  timestamp: 1,
}

function makePosition(overrides: Partial<PerpPositionSnapshot> = {}): PerpPositionSnapshot {
  return {
    symbol: 'BTC-PERP',
    side: 'long',
    size: 0.5,
    entryPrice: 68_000,
    markPrice: 70_000,
    positionValueUsd: 35_000,
    unrealizedPnlUsd: 1_000,
    roePct: 14.7,
    leverage: 10,
    leverageType: 'cross',
    liquidationPrice: 62_000,
    marginUsedUsd: 3_500,
    ...overrides,
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    identifier: 'o1',
    symbol: 'BTC-PERP',
    side: 'sell',
    size: 0.5,
    price: 75_000,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1,
    ...overrides,
  }
}

interface Options {
  positions?: ReadonlyArray<PerpPositionSnapshot>
  orders?: ReadonlyArray<Order>
  placeOrder?: Trader['placeOrder']
  cancelOrder?: Trader['cancelOrder']
  isSpectating?: boolean
}

function buildVenue(options: Options): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      trader: {
        placeOrder: options.placeOrder ?? vi.fn(() => okAsync(FILLED)),
        cancelOrder: options.cancelOrder ?? vi.fn(() => okAsync(undefined)),
        validateDraft: () => {
          throw new Error('unused')
        },
        previewOrder: () => {
          throw new Error('unused')
        },
      } as unknown as Trader,
      openOrdersSnapshot: {
        subscribe: (onUpdate: (o: ReadonlyArray<Order>) => void) => {
          onUpdate(options.orders ?? [])
          return () => {}
        },
      },
      ownAccount: {
        portfolio: { subscribeSnapshot: () => () => {}, getHistory: () => okAsync([]) },
        balances: { subscribe: () => () => {} },
        perpsPositionsSnapshot: {
          subscribe: (onUpdate: (p: ReadonlyArray<PerpPositionSnapshot>) => void) => {
            onUpdate(options.positions ?? [])
            return () => {}
          },
        },
        feeSchedule: { subscribe: () => () => {} },
        accountMode: { current: () => ({ isSegregated: true }), subscribe: () => () => {} },
      },
    },
  }
}

const SPECTATED = parseWalletAddress('0x1111111111111111111111111111111111111111')._unsafeUnwrap()

function spectate(isSpectating: boolean): SpectateContextValue {
  return {
    spectatedAddress: isSpectating ? SPECTATED : null,
    isSpectating,
    startSpectating: () => {},
    stopSpectating: () => {},
    watchlist: [],
    addToWatchlist: () => {},
    removeFromWatchlist: () => {},
    isWatchlisted: () => false,
  }
}

function render(options: Options = {}) {
  const venue = buildVenue(options)
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      SpectateContext.Provider,
      { value: spectate(options.isSpectating ?? false) },
      createElement(
        VenueContext.Provider,
        { value: venue },
        createElement(
          SelectedMarketContext.Provider,
          {
            value: {
              selectedMarket: MARKET.symbol,
              setSelectedMarket: () => {},
              market: MARKET,
            },
          },
          children,
        ),
      ),
    )
  return renderHook(() => usePositionPanel(), { wrapper })
}

describe('usePositionPanel', () => {
  it('is flat when no position exists on the selected market', () => {
    const { result } = render({ positions: [makePosition({ symbol: 'ETH-PERP' })] })
    expect(result.current.position).toBeNull()
  })

  it('surfaces the position on the selected market with a formatted liquidation price', () => {
    const { result } = render({ positions: [makePosition()] })
    expect(result.current.position?.symbol).toBe('BTC-PERP')
    expect(result.current.liquidationPriceText).toBe('62,000')
  })

  it('shows only the resting orders on the selected market', () => {
    const { result } = render({
      positions: [makePosition()],
      orders: [makeOrder(), makeOrder({ identifier: 'o2', symbol: 'ETH-PERP' })],
    })
    expect(result.current.orders.map((o) => o.identifier)).toEqual(['o1'])
  })

  it('closes the position with a reduce-only full-size market order on the opposite side', () => {
    const placeOrder = vi.fn<Trader['placeOrder']>(() => okAsync(FILLED))
    const { result } = render({ positions: [makePosition({ side: 'long', size: 0.5 })], placeOrder })

    act(() => result.current.closePosition())

    expect(placeOrder).toHaveBeenCalledTimes(1)
    const request = placeOrder.mock.calls[0][0] as PlaceOrderRequest
    expect(request).toMatchObject({
      orderType: 'market',
      symbol: 'BTC-PERP',
      side: 'sell',
      size: 0.5,
      reduceOnly: true,
    })
  })

  it('cancels a resting order by identifier', () => {
    const cancelOrder = vi.fn<Trader['cancelOrder']>(() => okAsync(undefined))
    const { result } = render({ positions: [makePosition()], orders: [makeOrder()], cancelOrder })

    act(() => result.current.cancelOrder(makeOrder()))

    expect(cancelOrder).toHaveBeenCalledWith('o1')
  })

  it('clears the in-flight flag when a cancel fails, so the row is not stuck', async () => {
    const cancelOrder = vi.fn<Trader['cancelOrder']>(() =>
      errAsync(new CancelOrderError('rejected', 'venue rejected the cancel')),
    )
    const { result } = render({ positions: [makePosition()], orders: [makeOrder()], cancelOrder })

    await act(async () => {
      result.current.cancelOrder(makeOrder())
    })

    expect(result.current.cancellingOrderIds.has('o1')).toBe(false)
  })

  it('hides the orders list while spectating', () => {
    // Positions are ACTING-keyed (your account) but open orders are VIEWING-keyed
    // (theirs). Rendering both would pair your position with someone else's
    // orders — and offer a cancel button for orders that are not yours.
    const { result } = render({
      positions: [makePosition()],
      orders: [makeOrder()],
      isSpectating: true,
    })
    expect(result.current.position).not.toBeNull()
    expect(result.current.showsOrders).toBe(false)
  })

  it('shows the orders list when not spectating', () => {
    const { result } = render({ positions: [makePosition()], orders: [makeOrder()] })
    expect(result.current.showsOrders).toBe(true)
  })
})
