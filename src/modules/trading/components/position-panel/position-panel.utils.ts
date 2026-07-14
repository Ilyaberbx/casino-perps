import type { Market, Order } from '@/modules/shared/domain'
import { formatPrice, specFromMarket } from '@/modules/shared/utils/format-price'
import type { PositionOrderKind } from './position-panel.types'

/**
 * What a resting order *does* to the position. The venue already models this —
 * `isPositionTpsl` + `triggerKind` come off the `Order` — so this is a read, not
 * an inference. A trader must be able to tell a take-profit from a stop-loss at
 * a glance; collapsing both to "limit order" is how you cancel the wrong one.
 */
export function positionOrderKind(order: Order): PositionOrderKind {
  if (order.triggerKind === 'tp') return 'take-profit'
  if (order.triggerKind === 'sl') return 'stop-loss'
  return 'limit'
}

/** The price the row shows: a trigger order fires at its trigger, a resting
 *  limit fills at its limit. Showing the wrong one misstates when it executes. */
export function positionOrderPrice(order: Order): number {
  return order.triggerPrice ?? order.price
}

/** Remaining (unfilled) size — what a cancel would actually pull. */
export function remainingSize(order: Order): number {
  return Math.max(order.size - order.filledSize, 0)
}

/**
 * The formatted liquidation price, or `null` when unknown / non-positive.
 * Falls back to a 2dp spec when market metadata has not resolved yet.
 */
export function liquidationPriceText(
  liquidationPrice: number | null,
  market: Market | undefined,
): string | null {
  const hasLiquidation =
    liquidationPrice !== null && Number.isFinite(liquidationPrice) && liquidationPrice > 0
  if (!hasLiquidation) return null
  const spec = market ? specFromMarket(market) : { szDecimals: 0, marketType: 'perp' as const }
  return formatPrice(liquidationPrice, spec)
}
