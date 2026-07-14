import type { PerpPositionSnapshot } from '@/modules/shared/domain'
import type { ExitLegKind, ExitTargetIssue } from './position-panel.types'

/**
 * Return on equity if the position closed at `triggerPrice`. Leverage is the
 * multiplier: a 2% move against 20× leverage is −40% of your margin, and that
 * is the number a trader actually feels. Showing the price alone hides it.
 *
 * Sign-aware: a long profits as price rises, a short as it falls.
 */
export function roiPctFor(
  triggerPrice: number,
  position: PerpPositionSnapshot,
): number | null {
  const { entryPrice, side, leverage } = position
  const isUsable =
    Number.isFinite(triggerPrice) &&
    triggerPrice > 0 &&
    entryPrice > 0 &&
    Number.isFinite(leverage) &&
    leverage > 0
  if (!isUsable) return null

  const priceMovePct = ((triggerPrice - entryPrice) / entryPrice) * 100
  const directional = side === 'long' ? priceMovePct : -priceMovePct
  return directional * leverage
}

/**
 * A take-profit must sit on the profitable side of entry, a stop-loss on the
 * losing side. Get this backwards and the "protection" fires instantly at the
 * mark — the venue would reject it, but a trader deserves to be told before
 * they submit, not after.
 */
export function isOnCorrectSide(
  kind: ExitLegKind,
  triggerPrice: number,
  position: PerpPositionSnapshot,
): boolean {
  const isLong = position.side === 'long'
  const wantsAboveEntry = kind === 'takeProfit' ? isLong : !isLong
  return wantsAboveEntry
    ? triggerPrice > position.entryPrice
    : triggerPrice < position.entryPrice
}

/**
 * A stop beyond the liquidation price is not a stop — you are liquidated first
 * and the order never fires. This is the check that separates a real stop-loss
 * from a comforting fiction.
 */
export function isBeyondLiquidation(
  triggerPrice: number,
  position: PerpPositionSnapshot,
): boolean {
  const liquidation = position.liquidationPrice
  const hasLiquidation =
    liquidation !== null && Number.isFinite(liquidation) && liquidation > 0
  if (!hasLiquidation) return false
  return position.side === 'long'
    ? triggerPrice <= liquidation
    : triggerPrice >= liquidation
}

/**
 * Everything wrong with a proposed pair of exit targets, in the order a trader
 * would want to hear it. An empty array means it is safe to submit.
 *
 * There is deliberately NO "the legs are crossed" rule. Both side checks are
 * relative to the ENTRY price — for a long, take-profit must sit above entry and
 * stop-loss below it — so a pair that passes them cannot cross. A cross rule
 * could only ever fire alongside a side error, duplicating it.
 */
export function validateExitTargets(
  takeProfit: number | null,
  stopLoss: number | null,
  position: PerpPositionSnapshot,
): ExitTargetIssue[] {
  const issues: ExitTargetIssue[] = []

  if (takeProfit !== null && !isOnCorrectSide('takeProfit', takeProfit, position)) {
    issues.push({
      leg: 'takeProfit',
      message:
        position.side === 'long'
          ? 'Take profit must be above your entry price'
          : 'Take profit must be below your entry price',
    })
  }

  if (stopLoss !== null) {
    if (!isOnCorrectSide('stopLoss', stopLoss, position)) {
      issues.push({
        leg: 'stopLoss',
        message:
          position.side === 'long'
            ? 'Stop loss must be below your entry price'
            : 'Stop loss must be above your entry price',
      })
    } else if (isBeyondLiquidation(stopLoss, position)) {
      issues.push({
        leg: 'stopLoss',
        message: 'Stop loss is past your liquidation price — you would be liquidated first',
      })
    }
  }

  return issues
}

/** Parse a user-typed price. Blank / unparseable / non-positive ⇒ `null` (unset). */
export function parseTriggerInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}
