import type { Fill, Position, Side } from '../../shared/domain'
import type { AccountState, RestingLimit } from '../mock-venue.types'

export function createAccountState(): AccountState {
  return {
    ordersByIdentifier: new Map(),
    restingLimitsBySymbol: new Map(),
    fills: [],
    positionsBySymbol: new Map(),
  }
}

export function getRestingForSymbol(
  state: AccountState,
  symbol: string,
): RestingLimit[] {
  return state.restingLimitsBySymbol.get(symbol) ?? []
}

export function setRestingForSymbol(
  state: AccountState,
  symbol: string,
  resting: RestingLimit[],
): void {
  state.restingLimitsBySymbol.set(symbol, resting)
}

export function applyFillToPosition(
  state: AccountState,
  fill: Fill,
  leverage: number,
): Position {
  const previous = state.positionsBySymbol.get(fill.symbol)
  const direction = fill.side === 'buy' ? 1 : -1
  const previousSignedSize = previous ? (previous.side === 'buy' ? previous.size : -previous.size) : 0
  const nextSignedSize = previousSignedSize + direction * fill.size

  const isFlat = nextSignedSize === 0
  if (isFlat) {
    state.positionsBySymbol.delete(fill.symbol)
    const flatPosition: Position = {
      symbol: fill.symbol,
      side: fill.side,
      size: 0,
      entryPrice: 0,
      markPrice: fill.price,
      unrealisedProfitAndLoss: 0,
      leverage,
      timestamp: fill.timestamp,
    }
    return flatPosition
  }

  const nextSide: Side = nextSignedSize > 0 ? 'buy' : 'sell'
  const nextSize = Math.abs(nextSignedSize)
  const isAddingToSameSide = previous !== undefined && previous.side === fill.side
  const previousNotional = isAddingToSameSide ? previous.entryPrice * previous.size : 0
  const fillNotional = fill.price * fill.size
  const nextEntryPrice = isAddingToSameSide
    ? (previousNotional + fillNotional) / (previous.size + fill.size)
    : fill.price

  const nextPosition: Position = {
    symbol: fill.symbol,
    side: nextSide,
    size: nextSize,
    entryPrice: nextEntryPrice,
    markPrice: fill.price,
    unrealisedProfitAndLoss: 0,
    leverage,
    timestamp: fill.timestamp,
  }
  state.positionsBySymbol.set(fill.symbol, nextPosition)
  return nextPosition
}
