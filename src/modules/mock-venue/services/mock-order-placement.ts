import type {
  LimitOrderRequest,
  Order,
  OrderIdentifier,
  PlaceOrderRequest,
} from '../../shared/domain'
import { PlaceOrderError } from '../../shared/domain'
import { matchMarketOrder, restLimit } from './matching-engine'
import {
  getRestingForSymbol,
  setRestingForSymbol,
  applyFillToPosition,
} from './account-state'
import type {
  MockOrderPlacement,
  MockOrderPlacementDeps,
  RestingLimit,
} from '../mock-venue.types'

/**
 * Order-placement seam for the mock venue. Owns market-fill and limit-rest:
 * matching (via matching-engine), the account-state mutations, and the
 * resulting order/fill/position/trade emissions. Extracted from
 * create-mock-venue.ts so the fill → account-mutation → emit path is testable
 * without standing up the full venue (ADR-0008).
 *
 * Resting-order crossing on a moving mid stays in the factory's book-tick path,
 * which shares `accountState` with this seam by reference.
 */
export function createMockOrderPlacement(deps: MockOrderPlacementDeps): MockOrderPlacement {
  const {
    accountState,
    bookStateMap,
    nextIdentifier,
    leverageFor,
    emitOrder,
    emitFill,
    emitPosition,
    broadcastTradeFromFill,
  } = deps

  function fillMarketOrder(
    request: PlaceOrderRequest,
    orderIdentifier: OrderIdentifier,
    timestamp: number,
  ): PlaceOrderError | null {
    const bookState = bookStateMap.get(request.symbol)
    const isBookEmpty = !bookState || bookState.bids.length === 0 || bookState.asks.length === 0
    if (isBookEmpty) {
      return new PlaceOrderError('book-empty', 'orderbook not yet available')
    }
    const fill = matchMarketOrder({
      orderIdentifier,
      fillIdentifier: nextIdentifier('fill'),
      symbol: request.symbol,
      side: request.side,
      size: request.size,
      book: { bids: bookState.bids, asks: bookState.asks },
      midPrice: bookState.lastMidPrice,
      timestamp,
    })
    const filledOrder: Order = {
      identifier: orderIdentifier,
      symbol: request.symbol,
      side: request.side,
      price: fill.price,
      size: request.size,
      filledSize: request.size,
      status: 'filled',
      orderType: 'market',
      timestamp,
    }
    accountState.ordersByIdentifier.set(orderIdentifier, filledOrder)
    accountState.fills.push(fill)
    const position = applyFillToPosition(accountState, fill, leverageFor(request.symbol))
    emitOrder(filledOrder)
    emitFill(fill)
    broadcastTradeFromFill(fill)
    emitPosition(position)
    return null
  }

  function placeLimitOrder(
    request: LimitOrderRequest,
    orderIdentifier: OrderIdentifier,
    timestamp: number,
  ): void {
    const limitOrder: Order = {
      identifier: orderIdentifier,
      symbol: request.symbol,
      side: request.side,
      price: request.price,
      size: request.size,
      filledSize: 0,
      status: 'open',
      orderType: 'limit',
      timestamp,
    }
    accountState.ordersByIdentifier.set(orderIdentifier, limitOrder)
    const resting: RestingLimit = {
      identifier: orderIdentifier,
      symbol: request.symbol,
      side: request.side,
      price: request.price,
      size: request.size,
      timestamp,
    }
    const previousResting = getRestingForSymbol(accountState, request.symbol)
    setRestingForSymbol(accountState, request.symbol, restLimit(previousResting, resting))
    emitOrder(limitOrder)
  }

  return { fillMarketOrder, placeLimitOrder }
}
