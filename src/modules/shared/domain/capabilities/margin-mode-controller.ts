import type { ResultAsync } from 'neverthrow'
import type { MarginMode } from '../domain.types'

export type SetMarginModeErrorKind = 'unknown-symbol' | 'rejected'

export class SetMarginModeError extends Error {
  readonly kind: SetMarginModeErrorKind
  constructor(kind: SetMarginModeErrorKind, message: string) {
    super(message)
    this.name = 'SetMarginModeError'
    this.kind = kind
  }
}

/**
 * Toggles per-market margin mode (cross / isolated). Like leverage, this is
 * venue account state applied via a signed action on change (PRD decision 12 /
 * HL `updateLeverage{isCross}`). Optional capability — absent slot hides the
 * Cross/Isolated toggle.
 */
export interface MarginModeController {
  setMarginMode(symbol: string, mode: MarginMode): ResultAsync<void, SetMarginModeError>
}
