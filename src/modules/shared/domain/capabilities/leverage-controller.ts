import type { ResultAsync } from 'neverthrow'

export type SetLeverageErrorKind = 'invalid-leverage' | 'unknown-symbol' | 'rejected'

export class SetLeverageError extends Error {
  readonly kind: SetLeverageErrorKind
  constructor(kind: SetLeverageErrorKind, message: string) {
    super(message)
    this.name = 'SetLeverageError'
    this.kind = kind
  }
}

/**
 * Sets per-market leverage. Leverage is venue account state, not an order field
 * (PRD decision 12 / HL `updateLeverage`) — the signed action fires immediately
 * on change and must precede an order. Optional capability: a venue without
 * leverage control simply omits the slot and the badge is not rendered.
 */
export interface LeverageController {
  setLeverage(symbol: string, leverage: number): ResultAsync<void, SetLeverageError>
}
