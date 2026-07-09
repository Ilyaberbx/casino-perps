import type { ResultAsync } from 'neverthrow'
import type { TriggerLeg } from '../domain.types'

export type SetPositionProtectionErrorKind =
  | 'no-position'
  | 'invalid-trigger'
  | 'unknown-symbol'
  | 'rejected'

export class SetPositionProtectionError extends Error {
  readonly kind: SetPositionProtectionErrorKind
  constructor(kind: SetPositionProtectionErrorKind, message: string) {
    super(message)
    this.name = 'SetPositionProtectionError'
    this.kind = kind
  }
}

/** TP/SL legs to attach to an existing position. Either or both may be set. */
export interface PositionProtectionLegs {
  takeProfit?: TriggerLeg
  stopLoss?: TriggerLeg
}

/**
 * Manages take-profit / stop-loss on an existing position (PRD decision 4 — HL
 * grouping `positionTpsl`, which scales with the position, distinct from the
 * entry-attached `normalTpsl` that goes through `Trader.placeOrder`). Optional
 * capability — absent slot hides position-level TP/SL editing.
 */
export interface PositionProtection {
  setProtection(
    symbol: string,
    legs: PositionProtectionLegs,
  ): ResultAsync<void, SetPositionProtectionError>
  clearProtection(symbol: string): ResultAsync<void, SetPositionProtectionError>
}
