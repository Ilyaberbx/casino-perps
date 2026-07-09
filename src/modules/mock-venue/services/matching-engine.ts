import type { Fill, OrderIdentifier, OrderbookLevel, Side } from '../../shared/domain'
import type {
  CrossResult,
  MarketFillInput,
  RestingLimit,
} from '../mock-venue.types'

const SLIPPAGE_DEPTH_REFERENCE = 10
const SLIPPAGE_BASIS_POINTS = 5

function totalDepth(levels: OrderbookLevel[]): number {
  let total = 0
  for (const level of levels) {
    total += level.size
  }
  return total
}

export function computeSlippageFraction(size: number, bookDepth: number): number {
  const isDepthMissing = bookDepth <= 0
  if (isDepthMissing) return SLIPPAGE_BASIS_POINTS / 10_000
  const depthRatio = size / bookDepth
  const slippage = (SLIPPAGE_BASIS_POINTS / 10_000) * (1 + depthRatio * SLIPPAGE_DEPTH_REFERENCE)
  return slippage
}

export function matchMarketOrder(input: MarketFillInput): Fill {
  const isBuy = input.side === 'buy'
  const opposingSide = isBuy ? input.book.asks : input.book.bids
  const depth = totalDepth(opposingSide)
  const slippageFraction = computeSlippageFraction(input.size, depth)
  const direction = isBuy ? 1 : -1
  const fillPrice = input.midPrice * (1 + direction * slippageFraction)
  return {
    identifier: input.fillIdentifier,
    orderIdentifier: input.orderIdentifier,
    symbol: input.symbol,
    side: input.side,
    price: fillPrice,
    size: input.size,
    fee: 0,
    timestamp: input.timestamp,
  }
}

export function restLimit(
  resting: RestingLimit[],
  order: RestingLimit,
): RestingLimit[] {
  return [...resting, order]
}

export function cancelLimit(
  resting: RestingLimit[],
  identifier: OrderIdentifier,
): RestingLimit[] {
  return resting.filter((order) => order.identifier !== identifier)
}

function didCross(
  side: Side,
  price: number,
  previousMid: number,
  nextMid: number,
): boolean {
  const isBuy = side === 'buy'
  const wasAboveBuyPrice = previousMid > price
  const isAtOrBelowBuyPrice = nextMid <= price
  const buyCrossed = isBuy && wasAboveBuyPrice && isAtOrBelowBuyPrice
  const wasBelowSellPrice = previousMid < price
  const isAtOrAboveSellPrice = nextMid >= price
  const sellCrossed = !isBuy && wasBelowSellPrice && isAtOrAboveSellPrice
  return buyCrossed || sellCrossed
}

export function tickRestingAgainstMid(
  previousMid: number,
  nextMid: number,
  resting: RestingLimit[],
  fillIdentifierFactory: () => OrderIdentifier,
  timestamp: number,
): CrossResult {
  const hasNoPreviousMid = previousMid <= 0
  if (hasNoPreviousMid) {
    return { filledOrders: [], fills: [], remaining: resting }
  }
  const filledOrders: RestingLimit[] = []
  const fills: Fill[] = []
  const remaining: RestingLimit[] = []
  for (const order of resting) {
    const crossed = didCross(order.side, order.price, previousMid, nextMid)
    if (!crossed) {
      remaining.push(order)
      continue
    }
    filledOrders.push(order)
    fills.push({
      identifier: fillIdentifierFactory(),
      orderIdentifier: order.identifier,
      symbol: order.symbol,
      side: order.side,
      price: order.price,
      size: order.size,
      fee: 0,
      timestamp,
    })
  }
  return { filledOrders, fills, remaining }
}
