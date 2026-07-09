import { errAsync } from 'neverthrow'
import type {
  LeverageController,
  MarginMode,
  MarginModeController,
} from '@/modules/shared/domain'
import { SetLeverageError, SetMarginModeError } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidExchangeGateway, HyperliquidGatewayError } from '../gateway'
import type { HyperliquidAgentWallet } from '../gateway'
import type { HyperliquidAssetInfo } from './hyperliquid-trader.types'

/** Current per-market leverage + margin mode, the two dimensions HL's single
 *  `updateLeverage` action expresses together. */
export interface HyperliquidLeverageState {
  readonly leverage: number
  readonly isCross: boolean
}

export interface HyperliquidLeverageMarginDeps {
  readonly exchangeGateway: HyperliquidExchangeGateway
  readonly getAgentWallet: () => HyperliquidAgentWallet | null
  readonly resolveAsset: (symbol: string) => HyperliquidAssetInfo | null
  /**
   * Current `{ leverage, isCross }` for a symbol, sourced from the live
   * positions snapshot; `null` when the user has no position there. HL's
   * `updateLeverage` always carries BOTH dimensions, so a single-dimension
   * change (set leverage / toggle margin mode) must re-send the unchanged
   * dimension — this resolver supplies it.
   */
  readonly getCurrentState: (symbol: string) => HyperliquidLeverageState | null
  readonly logger: Logger
}

const DEFAULT_LEVERAGE = 1
const DEFAULT_IS_CROSS = true

/**
 * Hyperliquid `leverageController` + `marginModeController` (PRD decision 12).
 * Both map onto the one HL `updateLeverage{ asset, isCross, leverage }` action:
 * setting leverage re-sends the current margin mode; toggling margin mode
 * re-sends the current leverage. Signed by the agent wallet via the exchange
 * gateway; a missing signer yields a typed `rejected` error (never a throw).
 */
export function createHyperliquidLeverageMargin(deps: HyperliquidLeverageMarginDeps): {
  leverageController: LeverageController
  marginModeController: MarginModeController
} {
  const log = deps.logger.child({ module: 'hyperliquid-leverage-margin' })

  function resolveState(symbol: string): HyperliquidLeverageState {
    return (
      deps.getCurrentState(symbol) ?? { leverage: DEFAULT_LEVERAGE, isCross: DEFAULT_IS_CROSS }
    )
  }

  const leverageController: LeverageController = {
    setLeverage(symbol, leverage) {
      const asset = deps.resolveAsset(symbol)
      if (asset === null) {
        return errAsync(new SetLeverageError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      const isLeverageInvalid = !(leverage >= 1) || !Number.isInteger(leverage)
      if (isLeverageInvalid) {
        return errAsync(
          new SetLeverageError('invalid-leverage', 'leverage must be an integer ≥ 1'),
        )
      }
      const agentWallet = deps.getAgentWallet()
      if (agentWallet === null) {
        return errAsync(new SetLeverageError('rejected', 'no approved agent wallet for signing'))
      }
      const { isCross } = resolveState(symbol)
      log.debug({ symbol }, 'set leverage')
      return deps.exchangeGateway
        .updateLeverage(agentWallet, { asset: asset.assetId, isCross, leverage })
        .map(() => undefined)
        .mapErr(
          (error: HyperliquidGatewayError) => new SetLeverageError('rejected', error.message),
        )
    },
  }

  const marginModeController: MarginModeController = {
    setMarginMode(symbol, mode: MarginMode) {
      const asset = deps.resolveAsset(symbol)
      if (asset === null) {
        return errAsync(new SetMarginModeError('unknown-symbol', `unknown symbol ${symbol}`))
      }
      const agentWallet = deps.getAgentWallet()
      if (agentWallet === null) {
        return errAsync(
          new SetMarginModeError('rejected', 'no approved agent wallet for signing'),
        )
      }
      const { leverage } = resolveState(symbol)
      const isCross = mode === 'cross'
      log.debug({ symbol }, 'set margin mode')
      return deps.exchangeGateway
        .updateLeverage(agentWallet, { asset: asset.assetId, isCross, leverage })
        .map(() => undefined)
        .mapErr(
          (error: HyperliquidGatewayError) => new SetMarginModeError('rejected', error.message),
        )
    },
  }

  return { leverageController, marginModeController }
}
