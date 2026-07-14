import type {
  PerpPositionSnapshot,
  PlaceOrderRequest,
  Side,
} from '@/modules/shared/domain'

/** Reduce-only close = an order on the opposite side of the position. */
export function closingSide(position: PerpPositionSnapshot): Side {
  return position.side === 'long' ? 'sell' : 'buy'
}

/** Clamp a requested close size to the position's open size; non-positive or
 *  NaN requests collapse to 0 (caller treats 0 as invalid). */
export function clampCloseSize(requested: number, positionSize: number): number {
  const isInvalid = !Number.isFinite(requested) || requested <= 0
  if (isInvalid) return 0
  const open = Math.abs(positionSize)
  return Math.min(requested, open)
}

/** Coin size for a fraction (0..1] of the open position size. */
export function closeSizeForFraction(fraction: number, positionSize: number): number {
  const open = Math.abs(positionSize)
  const isInvalid = !Number.isFinite(fraction) || fraction <= 0
  if (isInvalid) return 0
  return open * Math.min(fraction, 1)
}

interface MarketCloseArgs {
  position: PerpPositionSnapshot
  size: number
  slippageTolerance?: number
  clientOrderId: string
}

/** Build a reduce-only aggressive-IOC market close request. */
export function buildMarketCloseRequest({
  position,
  size,
  slippageTolerance,
  clientOrderId,
}: MarketCloseArgs): PlaceOrderRequest {
  return {
    orderType: 'market',
    symbol: position.symbol,
    side: closingSide(position),
    size,
    reduceOnly: true,
    slippageTolerance,
    clientOrderId,
  }
}

interface LimitCloseArgs {
  position: PerpPositionSnapshot
  size: number
  price: number
  clientOrderId: string
}

/** Build a reduce-only resting limit close request (Gtc). */
export function buildLimitCloseRequest({
  position,
  size,
  price,
  clientOrderId,
}: LimitCloseArgs): PlaceOrderRequest {
  return {
    orderType: 'limit',
    symbol: position.symbol,
    side: closingSide(position),
    size,
    price,
    timeInForce: 'Gtc',
    reduceOnly: true,
    clientOrderId,
  }
}
