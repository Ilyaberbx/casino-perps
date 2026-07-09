import type { Order, PerpPositionSnapshot, PositionProtectionLegs, Side, TriggerLeg } from '@/modules/shared/domain'
import { deriveTriggerPrice } from '@/modules/shared/utils/protection-coupling'
import type { DeriveTriggerContext } from '@/modules/shared/utils/protection-coupling.types'
import type { PositionTpslLegState, PositionTpslOrderRow } from './position-tpsl.types'

/** Map a position's long/short side to the coupling math's buy/sell `Side`. */
export function positionReferenceSide(side: PerpPositionSnapshot['side']): Side {
  return side === 'long' ? 'buy' : 'sell'
}

interface BuildPositionTpslLegsArgs {
  position: PerpPositionSnapshot
  takeProfit: PositionTpslLegState
  stopLoss: PositionTpslLegState
  /** Partial protect size in base units; undefined ⇒ full position size. */
  size: number | undefined
  /** Limit price for a trigger-limit; undefined ⇒ trigger-market. */
  limitPrice: number | undefined
}

function legContext(
  position: PerpPositionSnapshot,
  leg: PositionTpslLegState,
  kind: TriggerLeg['kind'],
): DeriveTriggerContext {
  return {
    kind,
    basis: leg.basis,
    side: positionReferenceSide(position.side),
    referencePrice: position.entryPrice,
    size: Math.abs(position.size),
  }
}

function buildLeg(
  kind: TriggerLeg['kind'],
  leg: PositionTpslLegState,
  context: DeriveTriggerContext,
  size: number | undefined,
  limitPrice: number | undefined,
): TriggerLeg | null {
  const triggerPrice = deriveTriggerPrice(leg.draft, context)
  if (triggerPrice === null) return null
  const built: TriggerLeg = { kind, trigger: { type: 'price', price: triggerPrice } }
  if (size !== undefined) built.size = size
  if (limitPrice !== undefined) built.limitPrice = limitPrice
  return built
}

/**
 * Build the `PositionProtectionLegs` to submit from the TP + SL leg drafts.
 * Each populated leg's gain/loss is coupled to an absolute trigger price off the
 * entry price. `size` (Configure Amount) and `limitPrice` (Limit Price) attach
 * to every built leg when set; absent ⇒ the full-size trigger-market default
 * (ADR-0054 D-5). Returns `null` when neither leg yields a usable trigger.
 */
export function buildPositionTpslLegs(args: BuildPositionTpslLegsArgs): PositionProtectionLegs | null {
  const { position, takeProfit, stopLoss, size, limitPrice } = args
  const tp = buildLeg(
    'take-profit',
    takeProfit,
    legContext(position, takeProfit, 'take-profit'),
    size,
    limitPrice,
  )
  const sl = buildLeg(
    'stop-loss',
    stopLoss,
    legContext(position, stopLoss, 'stop-loss'),
    size,
    limitPrice,
  )
  if (tp === null && sl === null) return null
  const legs: PositionProtectionLegs = {}
  if (tp !== null) legs.takeProfit = tp
  if (sl !== null) legs.stopLoss = sl
  return legs
}

function isProtectionLeg(order: Order, symbol: string): boolean {
  const isSameSymbol = order.symbol === symbol
  const isReduceOnly = order.reduceOnly === true
  const hasTriggerPrice = order.triggerPrice !== undefined && order.triggerPrice > 0
  return isSameSymbol && isReduceOnly && hasTriggerPrice
}

function classifyLeg(order: Order, position: PerpPositionSnapshot): 'tp' | 'sl' {
  if (order.triggerKind !== undefined) return order.triggerKind
  const triggerPrice = order.triggerPrice ?? 0
  const isAboveEntry = triggerPrice > position.entryPrice
  const isLong = position.side === 'long'
  const closesInProfit = isLong ? isAboveEntry : !isAboveEntry
  return closesInProfit ? 'tp' : 'sl'
}

/**
 * Project the resting reduce-only trigger orders for a position into Orders-tab
 * rows. Expected PnL = (triggerPrice − entryPrice) × |size| × sideSign, where
 * the side sign is +1 for a long position and −1 for a short (ADR-0051 / the
 * Orders read-back; see the modal spec).
 */
export function projectPositionTpslOrders(
  orders: ReadonlyArray<Order>,
  position: PerpPositionSnapshot,
): ReadonlyArray<PositionTpslOrderRow> {
  const sideSign = position.side === 'long' ? 1 : -1
  const absSize = Math.abs(position.size)
  const rows: PositionTpslOrderRow[] = []
  for (const order of orders) {
    const isLeg = isProtectionLeg(order, position.symbol)
    if (!isLeg) continue
    const kind = classifyLeg(order, position)
    const triggerPrice = order.triggerPrice ?? 0
    const expectedPnlUsd = (triggerPrice - position.entryPrice) * absSize * sideSign
    rows.push({
      identifier: order.identifier,
      typeLabel: kind === 'tp' ? 'Take Profit' : 'Stop Loss',
      triggerPrice,
      price: order.price,
      size: order.size,
      expectedPnlUsd,
    })
  }
  return rows
}
