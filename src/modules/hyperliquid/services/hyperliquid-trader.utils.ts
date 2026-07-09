import type {
  ClientOrderId,
  PlaceOrderOutcome,
  PlaceOrderOutcomeBase,
  Side,
  TriggerLeg,
} from '@/modules/shared/domain'
import { PlaceOrderError } from '@/modules/shared/domain'
import type {
  HyperliquidOrderStatus,
  HyperliquidTwapStatus,
  OrderSuccessResponse,
  TwapOrderSuccessResponse,
} from '../gateway'
import type { HyperliquidReferencePrice } from './hyperliquid-trader.types'

/**
 * HL `b` field: `true` for a long (buy), `false` for a short (sell).
 */
export function isBuySide(side: Side): boolean {
  return side === 'buy'
}

/**
 * Derive the aggressive IOC limit price for a simulated market order from
 * top-of-book at the slippage tolerance (PRD decision 9). A buy crosses *up*
 * from the best ask (× (1 + tolerance)); a sell crosses *down* from the best
 * bid (× (1 - tolerance)). When the relevant side of the book is empty, fall
 * back to mark. Returns `null` when neither a side price nor mark is available.
 */
export function deriveMarketReferencePrice(
  side: Side,
  reference: HyperliquidReferencePrice,
): number | null {
  const isBuy = isBuySide(side)
  const sidePrice = isBuy ? reference.topAsk : reference.topBid
  const hasSidePrice = sidePrice !== undefined && sidePrice > 0
  if (hasSidePrice) return sidePrice
  const hasMark = reference.mark !== undefined && reference.mark > 0
  if (hasMark) return reference.mark ?? null
  return null
}

/**
 * Apply the slippage tolerance to a reference price: a buy pays up, a sell
 * receives down. `tolerance` is a fraction (0.05 = 5%).
 */
export function applySlippage(referencePrice: number, side: Side, tolerance: number): number {
  const isBuy = isBuySide(side)
  const factor = isBuy ? 1 + tolerance : 1 - tolerance
  return referencePrice * factor
}

/**
 * Resolve a trigger leg's trigger price to an absolute number. `price` triggers
 * carry the absolute price directly; `percent` triggers are an offset from the
 * reference (entry / mark) price. A take-profit is above the reference for a
 * long and below for a short; a stop-loss is the inverse — so the percent sign
 * is applied relative to the leg kind and the position side.
 */
export function resolveTriggerPrice(
  leg: TriggerLeg,
  referencePrice: number,
  positionSide: Side,
): number {
  if (leg.trigger.type === 'price') return leg.trigger.price
  const fraction = leg.trigger.percent / 100
  const isLong = isBuySide(positionSide)
  const isTakeProfit = leg.kind === 'take-profit'
  // Take-profit moves favourably (up for a long, down for a short); stop-loss
  // moves adversely (down for a long, up for a short).
  const movesUp = isTakeProfit === isLong
  const direction = movesUp ? 1 : -1
  return referencePrice * (1 + direction * fraction)
}

/** HL `tpsl` literal for a trigger leg kind. */
export function triggerTpsl(leg: TriggerLeg): 'tp' | 'sl' {
  return leg.kind === 'take-profit' ? 'tp' : 'sl'
}

/**
 * A trigger leg closes the position, so its side is the opposite of the entry
 * side. Used for the attached TP/SL orders' `b` field.
 */
export function closingSide(entrySide: Side): Side {
  return isBuySide(entrySide) ? 'sell' : 'buy'
}

/**
 * Unpack a single HL per-order `statuses[]` entry into a `PlaceOrderOutcome`.
 * A `status:"ok"` envelope can still carry a per-order `{ error }` — that maps
 * to a `rejected` `PlaceOrderError` (the err branch), never to an outcome. The
 * `waitingForFill` / `waitingForTrigger` string statuses (trigger orders not
 * yet live) map to a `resting` outcome. See PRD decision 5.
 */
export function unpackOrderStatus(
  status: HyperliquidOrderStatus,
  base: PlaceOrderOutcomeBase,
): PlaceOrderOutcome | PlaceOrderError {
  if (typeof status === 'string') {
    // 'waitingForFill' | 'waitingForTrigger' — accepted, not yet matched.
    return { ...base, kind: 'resting' }
  }
  if ('error' in status) {
    return new PlaceOrderError('rejected', status.error)
  }
  if ('resting' in status) {
    return {
      ...base,
      kind: 'resting',
      orderIdentifier: String(status.resting.oid),
    }
  }
  // 'filled' in status
  const filledSize = Number(status.filled.totalSz)
  const averagePrice = Number(status.filled.avgPx)
  return {
    ...base,
    kind: 'filled',
    orderIdentifier: String(status.filled.oid),
    averagePrice,
    filledSize,
  }
}

/**
 * Unpack the primary order's status out of an HL order response into a domain
 * outcome / error. The first `statuses[]` entry is the entry order (any
 * attached TP/SL legs follow it). An empty `statuses[]` is a venue protocol
 * violation under `status:"ok"` and maps to a `rejected` error.
 */
export function unpackOrderResponse(
  response: OrderSuccessResponse,
  base: PlaceOrderOutcomeBase,
): PlaceOrderOutcome | PlaceOrderError {
  // The SDK's success type strips the per-order `{ error }` variant, but the
  // runtime value still carries it under a `status:"ok"` envelope (PRD
  // decision 5). Widen to the raw status union at this single boundary so the
  // `rejected` branch is reachable and exhaustively narrowed.
  const statuses = response.response.data.statuses as ReadonlyArray<HyperliquidOrderStatus>
  const primary = statuses[0]
  if (primary === undefined) {
    return new PlaceOrderError('rejected', 'order response carried no statuses')
  }
  return unpackOrderStatus(primary, base)
}

/** Build the shared outcome base from the request + acknowledgement time. */
export function buildOutcomeBase(
  symbol: string,
  clientOrderId: ClientOrderId | undefined,
  timestamp: number,
): PlaceOrderOutcomeBase {
  return { orderIdentifier: '', clientOrderId, symbol, timestamp }
}

/**
 * HL `tpsl` literal for a standalone **entry** stop order (ADR-0034 D-3). A
 * standalone trigger leg still carries a `tpsl` that sets the trigger
 * comparison direction. We derive it from the stop price relative to the
 * reference mark and the entry side: a stop in the **favourable** direction of
 * the order (above mark for a buy, below mark for a sell — i.e. a breakout
 * entry) is `tp`; a stop in the **adverse** direction is `sl`. Mirrors HL's
 * frontend convention for standalone stops. When no reference mark is available
 * the order still triggers on either side, so we default to `sl` (the
 * conservative stop-loss interpretation).
 */
export function resolveStopTpsl(
  side: Side,
  stopPrice: number,
  referenceMark: number | null,
): 'tp' | 'sl' {
  if (referenceMark === null) return 'sl'
  const isBuy = isBuySide(side)
  const isStopAboveMark = stopPrice > referenceMark
  const triggersFavourably = isStopAboveMark === isBuy
  return triggersFavourably ? 'tp' : 'sl'
}

/**
 * Clamp a TWAP duration (minutes) into Hyperliquid's accepted `[min, max]`
 * range (5..1440). The SDK's valibot schema hard-throws outside this range, so
 * the adapter clamps a UI off-by-one rather than surfacing an opaque SDK
 * validation throw (ADR-0034 D-1/D-3). Also floors to an integer — `m` is an
 * unsigned integer minute count.
 */
export function clampTwapMinutes(
  durationMinutes: number,
  minMinutes: number,
  maxMinutes: number,
): number {
  const floored = Math.floor(durationMinutes)
  const atLeastMin = Math.max(floored, minMinutes)
  return Math.min(atLeastMin, maxMinutes)
}

/**
 * Unpack a native TWAP `twapOrder` response into a domain outcome / error. A
 * `status:"ok"` envelope can still carry a TWAP `{ error }` (mirrors the order
 * path — ADR-0034 D-3): that maps to a `rejected` `PlaceOrderError`. A running
 * TWAP maps to a `resting` outcome carrying the `twapId` as the identifier (the
 * order is accepted and slicing, not yet fully filled).
 */
export function unpackTwapResponse(
  response: TwapOrderSuccessResponse,
  base: PlaceOrderOutcomeBase,
): PlaceOrderOutcome | PlaceOrderError {
  // The SDK's success type strips the `{ error }` variant, but a `status:"ok"`
  // envelope can still carry it at runtime. Widen to the raw status union at
  // this single boundary so the `rejected` branch is reachable + type-safe.
  const status = response.response.data.status as HyperliquidTwapStatus
  if ('error' in status) {
    return new PlaceOrderError('rejected', status.error)
  }
  return {
    ...base,
    kind: 'resting',
    orderIdentifier: String(status.running.twapId),
  }
}
