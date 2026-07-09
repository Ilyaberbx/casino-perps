import { describe, it, expect, vi } from 'vitest'
import type { LimitOrderRequest, MarketOrderRequest } from '../../../shared/domain'
import { createMockOrderPlacement } from '../mock-order-placement'
import { createAccountState } from '../account-state'
import type { BookState, MockOrderPlacementDeps } from '../../mock-venue.types'

const SYMBOL = 'BTC-PERP'

function populatedBook(): BookState {
  return {
    bids: [{ price: 99, size: 5 }],
    asks: [{ price: 101, size: 5 }],
    recentPriceDrift: 0,
    lastMidPrice: 100,
  }
}

function setup(book?: BookState) {
  const bookStateMap = new Map<string, BookState>()
  if (book) bookStateMap.set(SYMBOL, book)
  let counter = 0
  const deps: MockOrderPlacementDeps = {
    accountState: createAccountState(),
    bookStateMap,
    nextIdentifier: (prefix) => `${prefix}-${(counter += 1)}`,
    leverageFor: () => 5,
    emitOrder: vi.fn(),
    emitFill: vi.fn(),
    emitPosition: vi.fn(),
    broadcastTradeFromFill: vi.fn(),
  }
  return { placement: createMockOrderPlacement(deps), deps }
}

const marketBuy: MarketOrderRequest = {
  symbol: SYMBOL,
  side: 'buy',
  size: 1,
  orderType: 'market',
}

const limitBuy: LimitOrderRequest = {
  symbol: SYMBOL,
  side: 'buy',
  price: 95,
  size: 2,
  orderType: 'limit',
  timeInForce: 'Gtc',
}

describe('createMockOrderPlacement', () => {
  it('fills a market order: records it, emits order/fill/position/trade', () => {
    const { placement, deps } = setup(populatedBook())
    const error = placement.fillMarketOrder(marketBuy, 'order-1', 1000)

    expect(error).toBeNull()
    expect(deps.accountState.ordersByIdentifier.get('order-1')?.status).toBe('filled')
    expect(deps.accountState.fills).toHaveLength(1)
    expect(deps.emitOrder).toHaveBeenCalledTimes(1)
    expect(deps.emitFill).toHaveBeenCalledTimes(1)
    expect(deps.emitPosition).toHaveBeenCalledTimes(1)
    expect(deps.broadcastTradeFromFill).toHaveBeenCalledTimes(1)
  })

  it('returns book-empty when the orderbook has no levels yet', () => {
    const { placement } = setup() // no book
    const error = placement.fillMarketOrder(marketBuy, 'order-1', 1000)
    expect(error?.kind).toBe('book-empty')
  })

  it('rests a limit order: records it open and emits the order', () => {
    const { placement, deps } = setup(populatedBook())
    placement.placeLimitOrder(limitBuy, 'order-2', 1000)

    expect(deps.accountState.ordersByIdentifier.get('order-2')?.status).toBe('open')
    expect(deps.accountState.restingLimitsBySymbol.get(SYMBOL)).toHaveLength(1)
    expect(deps.emitOrder).toHaveBeenCalledTimes(1)
  })
})
