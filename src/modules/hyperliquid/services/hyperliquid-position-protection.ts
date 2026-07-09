import { errAsync, ok, okAsync, type Result, ResultAsync } from 'neverthrow'
import type {
  PositionProtection,
  PositionProtectionLegs,
  Side,
  TriggerLeg,
} from '@/modules/shared/domain'
import { SetPositionProtectionError } from '@/modules/shared/domain'
import type { Logger } from '@/modules/shared/logger'
import type { HyperliquidExchangeGateway, HyperliquidGatewayError } from '../gateway'
import type { HyperliquidAgentWallet, OrderParameters } from '../gateway'
import { GROUPING_POSITION_TPSL } from './hyperliquid-trader.constants'
import { closingSide, isBuySide, resolveTriggerPrice, triggerTpsl } from './hyperliquid-trader.utils'
import type {
  HyperliquidAssetInfo,
  HyperliquidBuilderParams,
  HyperliquidOrderRef,
} from './hyperliquid-trader.types'

/** Live position direction + size — the position-level TP/SL orders close it,
 *  so they take the opposite side and the position's reference price. */
export interface HyperliquidPositionState {
  readonly side: Side
  readonly size: number
  readonly referencePrice: number
}

export interface HyperliquidPositionProtectionDeps {
  readonly exchangeGateway: HyperliquidExchangeGateway
  readonly getAgentWallet: () => HyperliquidAgentWallet | null
  readonly resolveAsset: (symbol: string) => HyperliquidAssetInfo | null
  /** Current `{ side, size, referencePrice }` for a symbol; `null` ⇒ no position. */
  readonly getPositionState: (symbol: string) => HyperliquidPositionState | null
  /** Resting reduce-only trigger orders for a symbol (cleared on replace/remove). */
  readonly getProtectionOrderRefs: (symbol: string) => ReadonlyArray<HyperliquidOrderRef>
  readonly logger: Logger
  readonly builder: HyperliquidBuilderParams
}

/**
 * Hyperliquid `positionProtection` (PRD decision 4): manages take-profit /
 * stop-loss on an existing position via grouping `positionTpsl` (scales with
 * the position, distinct from the entry-attached `normalTpsl`). `setProtection`
 * first cancels any resting trigger orders for the symbol (replace semantics),
 * then places the new TP/SL legs as one signed action. `clearProtection`
 * cancels the resting trigger orders. Signed by the agent wallet; missing
 * signer / position / asset yield typed errors (never a throw). Not in the SDK
 * lint zone — it talks to the exchange gateway interface only.
 */
export function createHyperliquidPositionProtection(
  deps: HyperliquidPositionProtectionDeps,
): PositionProtection {
  const log = deps.logger.child({ module: 'hyperliquid-position-protection' })

  function roundPrice(
    price: number,
    asset: HyperliquidAssetInfo,
  ): Result<string, SetPositionProtectionError> {
    return deps.exchangeGateway
      .formatPrice(price, asset.szDecimals, asset.marketType)
      .mapErr((error) => new SetPositionProtectionError('invalid-trigger', error.message))
  }

  function roundSize(
    size: number,
    asset: HyperliquidAssetInfo,
  ): Result<string, SetPositionProtectionError> {
    return deps.exchangeGateway
      .formatSize(size, asset.szDecimals)
      .mapErr((error) => new SetPositionProtectionError('invalid-trigger', error.message))
  }

  function buildProtectionLeg(
    leg: TriggerLeg,
    asset: HyperliquidAssetInfo,
    position: HyperliquidPositionState,
  ): Result<OrderParameters['orders'][number], SetPositionProtectionError> {
    const triggerPx = resolveTriggerPrice(leg, position.referencePrice, position.side)
    const isMarketTrigger = leg.limitPrice === undefined
    const limitPriceForLeg = leg.limitPrice ?? triggerPx
    // ADR-0054 D-2/D-3: `leg.size` protects a partial position; absent ⇒ the
    // full current position size, resolved here so the gateway call is explicit.
    const orderSize = leg.size ?? Math.abs(position.size)
    return roundPrice(triggerPx, asset)
      .andThen((triggerPxStr) =>
        roundPrice(limitPriceForLeg, asset).map((limitPxStr) => ({ triggerPxStr, limitPxStr })),
      )
      .andThen(({ triggerPxStr, limitPxStr }) =>
        roundSize(orderSize, asset).map((s) => ({
          a: asset.assetId,
          b: isBuySide(closingSide(position.side)),
          p: limitPxStr,
          s,
          r: true,
          t: {
            trigger: { isMarket: isMarketTrigger, triggerPx: triggerPxStr, tpsl: triggerTpsl(leg) },
          },
        })),
      )
  }

  function buildProtectionLegs(
    legs: PositionProtectionLegs,
    asset: HyperliquidAssetInfo,
    position: HyperliquidPositionState,
  ): Result<OrderParameters['orders'], SetPositionProtectionError> {
    const triggerLegs: TriggerLeg[] = []
    if (legs.takeProfit !== undefined) triggerLegs.push(legs.takeProfit)
    if (legs.stopLoss !== undefined) triggerLegs.push(legs.stopLoss)
    return triggerLegs.reduce<Result<OrderParameters['orders'], SetPositionProtectionError>>(
      (accResult, leg) =>
        accResult.andThen((acc) =>
          buildProtectionLeg(leg, asset, position).map((built) => [...acc, built]),
        ),
      ok([]),
    )
  }

  function cancelExisting(
    symbol: string,
    agentWallet: HyperliquidAgentWallet,
  ): ResultAsync<void, SetPositionProtectionError> {
    const refs = deps.getProtectionOrderRefs(symbol)
    if (refs.length === 0) return okAsync(undefined)
    const cancels = refs.map((ref) => ({ a: ref.assetId, o: ref.oid }))
    return deps.exchangeGateway
      .cancelOrder(agentWallet, { cancels })
      .map(() => undefined)
      .mapErr((error: HyperliquidGatewayError) => new SetPositionProtectionError('rejected', error.message))
  }

  function setProtection(symbol: string, legs: PositionProtectionLegs) {
    const asset = deps.resolveAsset(symbol)
    if (asset === null) {
      return errAsync(new SetPositionProtectionError('unknown-symbol', `unknown symbol ${symbol}`))
    }
    const hasNoLeg = legs.takeProfit === undefined && legs.stopLoss === undefined
    if (hasNoLeg) {
      return errAsync(new SetPositionProtectionError('invalid-trigger', 'no TP/SL leg supplied'))
    }
    const position = deps.getPositionState(symbol)
    if (position === null) {
      return errAsync(new SetPositionProtectionError('no-position', `no open position for ${symbol}`))
    }
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new SetPositionProtectionError('rejected', 'no approved agent wallet for signing'))
    }
    const ordersResult = buildProtectionLegs(legs, asset, position)
    if (ordersResult.isErr()) return errAsync(ordersResult.error)
    log.debug({ symbol }, 'set protection')
    return cancelExisting(symbol, agentWallet).andThen(() =>
      deps.exchangeGateway
        .placeOrder(agentWallet, {
          orders: ordersResult.value,
          grouping: GROUPING_POSITION_TPSL,
          builder: { b: deps.builder.address, f: deps.builder.feeTenthsOfBps },
        })
        .map(() => undefined)
        .mapErr((error: HyperliquidGatewayError) => new SetPositionProtectionError('rejected', error.message)),
    )
  }

  function clearProtection(symbol: string) {
    const asset = deps.resolveAsset(symbol)
    if (asset === null) {
      return errAsync(new SetPositionProtectionError('unknown-symbol', `unknown symbol ${symbol}`))
    }
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new SetPositionProtectionError('rejected', 'no approved agent wallet for signing'))
    }
    log.debug({ symbol }, 'clear protection')
    return cancelExisting(symbol, agentWallet)
  }

  return { setProtection, clearProtection }
}
