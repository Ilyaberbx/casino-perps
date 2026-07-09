import { errAsync, okAsync } from 'neverthrow'
import type {
  LeverageController,
  MarginMode,
  MarginModeController,
} from '../../shared/domain'
import { SetLeverageError, SetMarginModeError } from '../../shared/domain'

/**
 * In-memory leverage + margin-mode state for the mock venue. Leverage and
 * margin mode are per-market venue account state (PRD decision 12), mutated by
 * a signed action on the real venue; the mock keeps them in two maps so every
 * leverage/margin UI branch is exercisable without a wallet. The state is read
 * back by the order-placement leverage lookup (`leverageFor`).
 */
export interface MockLeverageMarginState {
  readonly leverageController: LeverageController
  readonly marginModeController: MarginModeController
  /** Current leverage for a symbol, defaulting to 1 when never set. */
  leverageFor(symbol: string): number
  /** Current margin mode for a symbol, defaulting to cross when never set. */
  marginModeFor(symbol: string): MarginMode
}

export interface CreateMockLeverageMarginDeps {
  /** Resolve a market's max leverage for clamping; null/undefined ⇒ no cap. */
  readonly maxLeverageFor: (symbol: string) => number | null
  /** Symbol membership check for the `unknown-symbol` error path. */
  readonly isKnownSymbol: (symbol: string) => boolean
}

const DEFAULT_LEVERAGE = 1
const DEFAULT_MARGIN_MODE: MarginMode = 'cross'

export function createMockLeverageMargin(
  deps: CreateMockLeverageMarginDeps,
): MockLeverageMarginState {
  const leverageBySymbol = new Map<string, number>()
  const marginModeBySymbol = new Map<string, MarginMode>()

  const leverageController: LeverageController = {
    setLeverage(symbol, leverage) {
      if (!deps.isKnownSymbol(symbol)) {
        return errAsync(new SetLeverageError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      const isLeverageInvalid = !(leverage >= 1) || !Number.isFinite(leverage)
      if (isLeverageInvalid) {
        return errAsync(new SetLeverageError('invalid-leverage', 'leverage must be ≥ 1'))
      }
      const maxLeverage = deps.maxLeverageFor(symbol)
      const exceedsMax = maxLeverage !== null && leverage > maxLeverage
      if (exceedsMax) {
        return errAsync(
          new SetLeverageError('invalid-leverage', `leverage exceeds market max ${maxLeverage}`),
        )
      }
      leverageBySymbol.set(symbol, leverage)
      return okAsync(undefined)
    },
  }

  const marginModeController: MarginModeController = {
    setMarginMode(symbol, mode) {
      if (!deps.isKnownSymbol(symbol)) {
        return errAsync(new SetMarginModeError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      marginModeBySymbol.set(symbol, mode)
      return okAsync(undefined)
    },
  }

  return {
    leverageController,
    marginModeController,
    leverageFor(symbol) {
      return leverageBySymbol.get(symbol) ?? DEFAULT_LEVERAGE
    },
    marginModeFor(symbol) {
      return marginModeBySymbol.get(symbol) ?? DEFAULT_MARGIN_MODE
    },
  }
}
