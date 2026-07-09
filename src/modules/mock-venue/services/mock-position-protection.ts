import { errAsync, okAsync } from 'neverthrow'
import type {
  PositionProtection,
  PositionProtectionLegs,
} from '../../shared/domain'
import { SetPositionProtectionError } from '../../shared/domain'

/**
 * In-memory `positionProtection` for the mock venue (PRD decision 4). Records
 * the TP/SL legs attached to a symbol's open position so the position-level
 * TP/SL UI branch is exercisable without a wallet. `setProtection` requires an
 * open position (`no-position` otherwise) and at least one leg; `clearProtection`
 * drops the recorded legs. The mock does not yet simulate the trigger fills —
 * deepening that is the mock-completeness task.
 */
export interface MockPositionProtectionState {
  readonly positionProtection: PositionProtection
  /** Currently-recorded legs for a symbol (undefined ⇒ none). */
  protectionFor(symbol: string): PositionProtectionLegs | undefined
}

export interface CreateMockPositionProtectionDeps {
  readonly isKnownSymbol: (symbol: string) => boolean
  readonly hasPosition: (symbol: string) => boolean
}

export function createMockPositionProtection(
  deps: CreateMockPositionProtectionDeps,
): MockPositionProtectionState {
  const protectionBySymbol = new Map<string, PositionProtectionLegs>()

  const positionProtection: PositionProtection = {
    setProtection(symbol, legs) {
      if (!deps.isKnownSymbol(symbol)) {
        return errAsync(new SetPositionProtectionError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      const hasNoLeg = legs.takeProfit === undefined && legs.stopLoss === undefined
      if (hasNoLeg) {
        return errAsync(new SetPositionProtectionError('invalid-trigger', 'no TP/SL leg supplied'))
      }
      if (!deps.hasPosition(symbol)) {
        return errAsync(
          new SetPositionProtectionError('no-position', `no open position for ${symbol}`),
        )
      }
      protectionBySymbol.set(symbol, legs)
      return okAsync(undefined)
    },
    clearProtection(symbol) {
      if (!deps.isKnownSymbol(symbol)) {
        return errAsync(new SetPositionProtectionError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      protectionBySymbol.delete(symbol)
      return okAsync(undefined)
    },
  }

  return {
    positionProtection,
    protectionFor(symbol) {
      return protectionBySymbol.get(symbol)
    },
  }
}
