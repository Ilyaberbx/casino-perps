import type { TriggerLeg, TriggerSpec } from '@/modules/shared/domain'
import {
  coupleFromAmountInput,
  coupleFromPriceInput,
  deriveAmountInput,
  deriveTriggerPrice,
  isLegPopulated,
  isLegValid,
  reprojectLegToBasis,
  triggerKindFor,
} from '@/modules/shared/utils/protection-coupling'
import type {
  BuiltEntryProtection,
  DeriveTriggerContext,
  EntryProtectionDraft,
  ProtectionBasis,
  ProtectionContext,
} from './order-entry.types'

// The pure per-leg coupling math (price ⇄ gain/loss, $/% reprojection, single-leg
// validity) lives in `shared/utils/protection-coupling` so the shared account-dock
// Position TP/SL modal can reuse it without deep-importing `trading/`. This file
// keeps the trading-draft-level wrappers (the 2×2 `EntryProtectionDraft`) and
// re-exports the shared primitives that `use-order-entry` already consumes.
export {
  coupleFromAmountInput,
  coupleFromPriceInput,
  deriveAmountInput,
  deriveTriggerPrice,
  isLegPopulated,
  isLegValid,
  reprojectLegToBasis,
  triggerKindFor,
}

/**
 * Reproject the whole draft's gain/loss column into `nextBasis` (the $/% toggle
 * handler). Both legs are reprojected with their own kind; the section's
 * `enabled` flag and price strings are preserved. See IA "Attach TP/SL" flow 3.
 */
export function reprojectProtectionToBasis(
  protection: EntryProtectionDraft,
  context: ProtectionContext,
  nextBasis: ProtectionBasis,
): EntryProtectionDraft {
  const takeProfit = reprojectLegToBasis(
    protection.takeProfit,
    { ...context, kind: 'take-profit' },
    nextBasis,
  )
  const stopLoss = reprojectLegToBasis(
    protection.stopLoss,
    { ...context, kind: 'stop-loss' },
    nextBasis,
  )
  return { ...protection, basis: nextBasis, takeProfit, stopLoss }
}

function buildLeg(
  kind: TriggerLeg['kind'],
  draft: EntryProtectionDraft['takeProfit'],
  context: Omit<DeriveTriggerContext, 'kind'>,
): TriggerLeg | null {
  const triggerPrice = deriveTriggerPrice(draft, { ...context, kind })
  if (triggerPrice === null) return null
  const trigger: TriggerSpec = { type: 'price', price: triggerPrice }
  return { kind, trigger }
}

/** Validate the whole protection draft. A disabled section is always valid; an
 *  enabled section requires every populated leg to yield a positive trigger. */
export function isProtectionValid(
  protection: EntryProtectionDraft,
  context: ProtectionContext,
): boolean {
  if (!protection.enabled) return true
  const base = { ...context, basis: protection.basis }
  const isTakeProfitValid = isLegValid(protection.takeProfit, { ...base, kind: 'take-profit' })
  const isStopLossValid = isLegValid(protection.stopLoss, { ...base, kind: 'stop-loss' })
  return isTakeProfitValid && isStopLossValid
}

/** Build the `{ takeProfit?, stopLoss? }` legs to thread into `placeOrder` from
 *  the 2×2 draft. A disabled section or an unpopulated/invalid leg is omitted. */
export function buildEntryProtection(
  protection: EntryProtectionDraft,
  context: ProtectionContext,
): BuiltEntryProtection {
  const result: BuiltEntryProtection = {}
  if (!protection.enabled) return result
  const base = { ...context, basis: protection.basis }
  const takeProfit = buildLeg('take-profit', protection.takeProfit, base)
  if (takeProfit !== null) result.takeProfit = takeProfit
  const stopLoss = buildLeg('stop-loss', protection.stopLoss, base)
  if (stopLoss !== null) result.stopLoss = stopLoss
  return result
}
