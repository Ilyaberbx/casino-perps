import type { Side, TriggerLeg } from '@/modules/shared/domain'

/** The $ / % toggle that governs how a leg's gain/loss magnitude is expressed. */
export type ProtectionBasis = 'usd' | 'percent'

/** Which protection leg slot a setter/derivation targets. */
export type ProtectionLegKind = 'takeProfit' | 'stopLoss'

/** One protection leg's coupled draft fields. `priceInput` and `amountInput`
 *  (gain for take-profit / loss for stop-loss) are coupled — entering one
 *  derives the other from the reference (entry/mark) price. */
export interface ProtectionLegDraft {
  priceInput: string
  /** Gain (take-profit) or loss (stop-loss) magnitude in the active basis. */
  amountInput: string
}

/** Context the price ⇄ gain/loss derivation needs for a single leg. */
export interface DeriveTriggerContext {
  kind: TriggerLeg['kind']
  basis: ProtectionBasis
  side: Side
  /** Entry/mark price the gain/loss is projected off. */
  referencePrice: number
  /** Position/order size in coin units — converts a $ gain/loss into a price
   *  offset. */
  size: number
}
