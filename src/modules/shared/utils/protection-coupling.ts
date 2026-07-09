import type { Side, TriggerLeg } from '@/modules/shared/domain'
import type {
  DeriveTriggerContext,
  ProtectionBasis,
  ProtectionLegDraft,
  ProtectionLegKind,
} from './protection-coupling.types'

/**
 * Pure, React-free coupling math for TP/SL legs (entry-attached and
 * position-level). A leg's price and its gain/loss magnitude are coupled —
 * entering one derives the other off the reference (entry/mark) price. This
 * module is the single source of truth for that derivation; the trading
 * order-entry helper and the shared account-dock Position TP/SL modal both
 * consume it. See ADR-0054 (and ADR-0051 for the read-back complement).
 */

/** Map a draft leg slot (`takeProfit`/`stopLoss`) to its trigger kind. */
export function triggerKindFor(leg: ProtectionLegKind): TriggerLeg['kind'] {
  return leg === 'takeProfit' ? 'take-profit' : 'stop-loss'
}

function parsePositive(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  const isValid = Number.isFinite(parsed) && parsed > 0
  if (!isValid) return null
  return parsed
}

function parseFinite(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

/** Whether a leg carries any input the user intends as a trigger. */
export function isLegPopulated(draft: ProtectionLegDraft): boolean {
  return draft.priceInput.trim().length > 0 || draft.amountInput.trim().length > 0
}

/**
 * Direction of a leg's trigger relative to entry: take-profit moves with the
 * side's favourable direction (long → above, short → below); stop-loss moves
 * against it.
 *
 * Returns +1 when the derived trigger sits above the reference price, −1 below.
 */
function triggerDirection(kind: TriggerLeg['kind'], side: Side): number {
  const isLong = side === 'buy'
  const isTakeProfit = kind === 'take-profit'
  const movesUp = isLong === isTakeProfit
  return movesUp ? 1 : -1
}

/**
 * Derive the absolute trigger price for a leg from its draft. Price input wins
 * when present; otherwise the gain/loss amount is projected off the reference
 * (entry/mark) price per the basis:
 *
 * - `usd` basis: trigger = reference ± (amount / size), i.e. a $ P&L target.
 * - `percent` basis: trigger = reference × (1 ± amount/100), i.e. a % ROI target.
 *
 * Returns null when nothing usable can be derived (no positive trigger).
 */
export function deriveTriggerPrice(
  draft: ProtectionLegDraft,
  context: DeriveTriggerContext,
): number | null {
  const explicitPrice = parsePositive(draft.priceInput)
  if (explicitPrice !== null) return explicitPrice

  const amount = parseFinite(draft.amountInput)
  const hasUsableAmount = amount !== null && amount > 0
  if (!hasUsableAmount) return null

  const hasUsableReference = context.referencePrice > 0
  if (!hasUsableReference) return null

  const direction = triggerDirection(context.kind, context.side)
  const isPercentBasis = context.basis === 'percent'
  const percentOffset = (amount / 100) * context.referencePrice
  const hasUsableSize = context.size > 0
  const usdOffset = hasUsableSize ? amount / context.size : 0
  const offset = isPercentBasis ? percentOffset : usdOffset
  const trigger = context.referencePrice + direction * offset
  return trigger > 0 ? trigger : null
}

const DERIVED_PRICE_DECIMALS = 6
const DERIVED_AMOUNT_DECIMALS = 4

/** Round to a plain (un-grouped) numeric string suited for an `<input value>` —
 *  trailing zeros trimmed, no thousands separators. Returns '' for non-finite. */
function toPlainInput(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return ''
  const factor = 10 ** decimals
  const rounded = Math.round(value * factor) / factor
  return String(rounded)
}

/**
 * Inverse of {@link deriveTriggerPrice}: given an explicit trigger price, compute
 * the gain/loss magnitude expressed in the active basis. The amount is always a
 * positive magnitude (the direction is implied by the leg kind), so a price on
 * the "wrong" side of the reference still yields a magnitude — validity is the
 * derive-price direction check's job, not this projection's.
 *
 * - `percent` basis: amount = |price − reference| / reference × 100 (% ROI).
 * - `usd` basis:     amount = |price − reference| × size ($ P&L).
 *
 * Returns '' when nothing usable can be derived (no reference, or `usd` with no
 * size).
 */
export function deriveAmountInput(price: number, context: DeriveTriggerContext): string {
  const hasUsablePrice = Number.isFinite(price) && price > 0
  if (!hasUsablePrice) return ''

  const hasUsableReference = context.referencePrice > 0
  if (!hasUsableReference) return ''

  const priceDelta = Math.abs(price - context.referencePrice)
  const isPercentBasis = context.basis === 'percent'
  const percentAmount = (priceDelta / context.referencePrice) * 100
  const hasUsableSize = context.size > 0
  const usdAmount = hasUsableSize ? priceDelta * context.size : null
  if (!isPercentBasis && usdAmount === null) return ''

  const amount = isPercentBasis ? percentAmount : (usdAmount ?? 0)
  return toPlainInput(amount, DERIVED_AMOUNT_DECIMALS)
}

/**
 * Couple a leg from a freshly-typed **price**: the typed price is kept verbatim,
 * the gain/loss amount is re-derived off it (empty price clears the amount).
 */
export function coupleFromPriceInput(
  priceInput: string,
  context: DeriveTriggerContext,
): ProtectionLegDraft {
  const price = parsePositive(priceInput)
  const amountInput = price === null ? '' : deriveAmountInput(price, context)
  return { priceInput, amountInput }
}

/**
 * Couple a leg from a freshly-typed **gain/loss amount**: the typed amount is
 * kept verbatim, the price is re-derived off it (empty amount clears the price).
 */
export function coupleFromAmountInput(
  amountInput: string,
  context: DeriveTriggerContext,
): ProtectionLegDraft {
  const derivedPrice = deriveTriggerPrice({ priceInput: '', amountInput }, context)
  const priceInput = derivedPrice === null ? '' : toPlainInput(derivedPrice, DERIVED_PRICE_DECIMALS)
  return { priceInput, amountInput }
}

function oppositeBasis(basis: ProtectionBasis): ProtectionBasis {
  return basis === 'percent' ? 'usd' : 'percent'
}

/**
 * Reproject one leg's gain/loss amount into a new basis on a $/% toggle. The
 * leg's effective price (explicit, else derived off the old amount) is held
 * fixed and its amount is re-expressed in `nextBasis`. The price string is kept
 * verbatim. An empty/underivable leg passes through unchanged.
 */
export function reprojectLegToBasis(
  draft: ProtectionLegDraft,
  context: Omit<DeriveTriggerContext, 'basis'>,
  nextBasis: ProtectionBasis,
): ProtectionLegDraft {
  const oldContext: DeriveTriggerContext = { ...context, basis: oppositeBasis(nextBasis) }
  const effectivePrice = deriveTriggerPrice(draft, oldContext)
  if (effectivePrice === null) return draft
  const nextContext: DeriveTriggerContext = { ...context, basis: nextBasis }
  const explicitPrice = parsePositive(draft.priceInput)
  const priceInput =
    explicitPrice !== null ? draft.priceInput : toPlainInput(effectivePrice, DERIVED_PRICE_DECIMALS)
  return { priceInput, amountInput: deriveAmountInput(effectivePrice, nextContext) }
}

/** Whether one leg is valid: an unpopulated leg contributes nothing (valid); a
 *  populated leg must yield a positive derived trigger. */
export function isLegValid(draft: ProtectionLegDraft, context: DeriveTriggerContext): boolean {
  if (!isLegPopulated(draft)) return true
  return deriveTriggerPrice(draft, context) !== null
}
