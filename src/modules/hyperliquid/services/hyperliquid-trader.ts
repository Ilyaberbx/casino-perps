import { Result, ResultAsync, err, errAsync, ok } from 'neverthrow'
import type {
  LimitOrderRequest,
  ModifyOrderRequest,
  OrderIdentifier,
  PlaceOrderOutcome,
  PlaceOrderRequest,
  TriggerLeg,
  TwapOrderRequest,
} from '@/modules/shared/domain'
import {
  CancelOrderError,
  ModifyOrderError,
  PlaceOrderError,
  type Trader,
} from '@/modules/shared/domain'

/**
 * The trader surface this factory builds: place / cancel / modify + the
 * capability flags. The venue composition adds the ADR-0035 `validateDraft` /
 * `previewOrder` methods (owned by `createHyperliquidOrderValidation`) to
 * complete the `Trader` port — they need account-state readers this factory
 * does not take, so they live in a sibling service.
 */
export type HyperliquidBaseTrader = Omit<Trader, 'validateDraft' | 'previewOrder'>
import type {
  HyperliquidCancelStatus,
  HyperliquidGatewayError,
  ModifyParameters,
  OrderParameters,
  TwapOrderParameters,
} from '../gateway'
import {
  DEFAULT_MARKET_SLIPPAGE_TOLERANCE,
  GROUPING_NONE,
  GROUPING_NORMAL_TPSL,
  MARKET_ORDER_TIF,
  TWAP_MAX_DURATION_MINUTES,
  TWAP_MIN_DURATION_MINUTES,
} from './hyperliquid-trader.constants'
import type {
  HyperliquidAssetInfo,
  HyperliquidOrderRef,
  HyperliquidTraderDeps,
  StopOrderRequest,
} from './hyperliquid-trader.types'
import {
  applySlippage,
  buildOutcomeBase,
  clampTwapMinutes,
  closingSide,
  deriveMarketReferencePrice,
  isBuySide,
  resolveStopTpsl,
  resolveTriggerPrice,
  triggerTpsl,
  unpackOrderResponse,
  unpackTwapResponse,
} from './hyperliquid-trader.utils'

type OrderLeg = OrderParameters['orders'][number]

/**
 * Hyperliquid `trader` capability (PRD decision 3 / ADR-0034 D-3) — place
 * (market, limit, stop-market, stop-limit, TWAP; market/limit carry optional
 * entry-attached TP/SL), cancel (by oid), and modify.
 *
 * The adapter owns the venue-agnostic → HL translation: asset-id + szDecimals
 * resolution, top-of-book IOC pricing for market / stop-market orders, native
 * trigger-leg construction for stops (`t.trigger`, grouping `na`), the native
 * `twapOrder` action for TWAP, price/size rounding via the gateway's SDK
 * `formatPrice`/`formatSize`, builder-fee + cloid attachment, attached-TP/SL
 * trigger-leg construction (grouping `normalTpsl`), and unpacking
 * the per-order `statuses[]` into `PlaceOrderOutcome` / raw-string `rejected`
 * errors. Signing + POST live in the exchange gateway (the SDK lint zone); this
 * service never touches the SDK.
 */
export function createHyperliquidTrader(deps: HyperliquidTraderDeps): HyperliquidBaseTrader {
  const log = deps.logger.child({ module: 'hyperliquid-trader' })
  const defaultSlippage = deps.defaultSlippageTolerance ?? DEFAULT_MARKET_SLIPPAGE_TOLERANCE

  function roundPrice(price: number, asset: HyperliquidAssetInfo): Result<string, PlaceOrderError> {
    return deps.exchangeGateway
      .formatPrice(price, asset.szDecimals, asset.marketType)
      .mapErr((error) => new PlaceOrderError('invalid-price', error.message))
  }

  function roundSize(size: number, asset: HyperliquidAssetInfo): Result<string, PlaceOrderError> {
    return deps.exchangeGateway
      .formatSize(size, asset.szDecimals)
      .mapErr((error) => new PlaceOrderError('invalid-size', error.message))
  }

  /** Resolve the unrounded entry price (signed): explicit for a limit /
   *  stop-limit order, a derived aggressive IOC for a market / stop-market order
   *  (top-of-book × (1 ± slippage)). TWAP is routed separately and never reaches
   *  this path. */
  function resolveEntryPrice(
    request: PlaceOrderRequest,
    symbol: string,
    side: PlaceOrderRequest['side'],
  ): Result<number, PlaceOrderError> {
    if (request.orderType === 'limit') return ok(request.price)
    if (request.orderType === 'stop-limit') return ok(request.price)
    // TWAP never reaches here (routed before this path); narrow defensively.
    const isTwap = request.orderType === 'twap'
    if (isTwap) {
      return err(new PlaceOrderError('unsupported-order-type', 'twap is not priced as a single order'))
    }
    // market + stop-market derive an aggressive IOC limit price off top-of-book.
    return deriveAggressivePrice(symbol, side, request.slippageTolerance)
  }

  /** Aggressive IOC limit price off top-of-book × (1 ± slippage) — the fill
   *  price for a market order and a triggered stop-market order. */
  function deriveAggressivePrice(
    symbol: string,
    side: PlaceOrderRequest['side'],
    slippageTolerance: number | undefined,
  ): Result<number, PlaceOrderError> {
    const reference = deps.getReferencePrice(symbol)
    if (reference === null) {
      return err(new PlaceOrderError('book-empty', `no reference price for ${symbol}`))
    }
    const referencePrice = deriveMarketReferencePrice(side, reference)
    if (referencePrice === null) {
      return err(new PlaceOrderError('book-empty', `no top-of-book or mark for ${symbol}`))
    }
    const tolerance = slippageTolerance ?? defaultSlippage
    return ok(applySlippage(referencePrice, side, tolerance))
  }

  function isStopRequest(request: PlaceOrderRequest): request is StopOrderRequest {
    return request.orderType === 'stop-market' || request.orderType === 'stop-limit'
  }

  function buildEntryLeg(
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    entryPrice: number,
    cloid: `0x${string}` | undefined,
  ): Result<OrderLeg, PlaceOrderError> {
    if (isStopRequest(request)) return buildStopEntryLeg(request, asset, entryPrice, cloid)
    return buildPlainEntryLeg(request, asset, entryPrice, cloid)
  }

  /** A market / limit entry leg (`t: { limit: { tif } }`). */
  function buildPlainEntryLeg(
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    entryPrice: number,
    cloid: `0x${string}` | undefined,
  ): Result<OrderLeg, PlaceOrderError> {
    const isLimit = request.orderType === 'limit'
    return roundPrice(entryPrice, asset).andThen((p) =>
      roundSize(request.size, asset).map((s) => {
        const tif = isLimit ? (request as LimitOrderRequest).timeInForce : MARKET_ORDER_TIF
        return withCloid({
          a: asset.assetId,
          b: isBuySide(request.side),
          p,
          s,
          r: request.reduceOnly ?? false,
          t: { limit: { tif } },
        }, cloid)
      }),
    )
  }

  /** A native HL trigger entry leg for a stop-market / stop-limit order
   *  (`t: { trigger: { isMarket, triggerPx, tpsl } }`, grouping `na`). `p` is the
   *  aggressive IOC price (stop-market) or the resting limit price (stop-limit);
   *  `triggerPx = stopPrice`. ADR-0034 D-3. */
  function buildStopEntryLeg(
    request: StopOrderRequest,
    asset: HyperliquidAssetInfo,
    entryPrice: number,
    cloid: `0x${string}` | undefined,
  ): Result<OrderLeg, PlaceOrderError> {
    const isMarketTrigger = request.orderType === 'stop-market'
    const referenceMark = deps.getReferencePrice(request.symbol)?.mark ?? null
    const tpsl = resolveStopTpsl(request.side, request.stopPrice, referenceMark)
    return roundPrice(entryPrice, asset).andThen((p) =>
      roundPrice(request.stopPrice, asset).andThen((triggerPx) =>
        roundSize(request.size, asset).map((s) =>
          withCloid({
            a: asset.assetId,
            b: isBuySide(request.side),
            p,
            s,
            r: request.reduceOnly ?? false,
            t: { trigger: { isMarket: isMarketTrigger, triggerPx, tpsl } },
          }, cloid),
        ),
      ),
    )
  }

  function withCloid(leg: OrderLeg, cloid: `0x${string}` | undefined): OrderLeg {
    if (cloid === undefined) return leg
    return { ...leg, c: cloid }
  }

  /** Build one attached trigger leg (TP or SL) — closes the entry size,
   *  opposite side, reduce-only; grouping is `normalTpsl` at the action level. */
  function buildTriggerLeg(
    leg: TriggerLeg,
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    entryReferencePrice: number,
  ): Result<OrderLeg, PlaceOrderError> {
    const triggerPx = resolveTriggerPrice(leg, entryReferencePrice, request.side)
    const isMarketTrigger = leg.limitPrice === undefined
    const limitPriceForLeg = leg.limitPrice ?? triggerPx
    return roundPrice(triggerPx, asset)
      .andThen((triggerPxStr) =>
        roundPrice(limitPriceForLeg, asset).map((limitPxStr) => ({ triggerPxStr, limitPxStr })),
      )
      .andThen(({ triggerPxStr, limitPxStr }) =>
        roundSize(request.size, asset).map((s) => ({
          a: asset.assetId,
          b: isBuySide(closingSide(request.side)),
          p: limitPxStr,
          s,
          r: true,
          t: {
            trigger: {
              isMarket: isMarketTrigger,
              triggerPx: triggerPxStr,
              tpsl: triggerTpsl(leg),
            },
          },
        })),
      )
  }

  function buildAttachedTriggerLegs(
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    entryReferencePrice: number,
  ): Result<OrderLeg[], PlaceOrderError> {
    const legs: TriggerLeg[] = []
    if (request.takeProfit !== undefined) legs.push(request.takeProfit)
    if (request.stopLoss !== undefined) legs.push(request.stopLoss)

    return legs.reduce<Result<OrderLeg[], PlaceOrderError>>(
      (accResult, leg) =>
        accResult.andThen((acc) =>
          buildTriggerLeg(leg, request, asset, entryReferencePrice).map((built) => [...acc, built]),
        ),
      ok<OrderLeg[], PlaceOrderError>([]),
    )
  }

  function buildOrderParams(
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    cloid: `0x${string}` | undefined,
  ): Result<OrderParameters, PlaceOrderError> {
    return resolveEntryPrice(request, request.symbol, request.side).andThen((entryPrice) =>
      buildEntryLeg(request, asset, entryPrice, cloid).andThen((entryLeg) =>
        buildAttachedTriggerLegs(request, asset, entryPrice).map((triggerLegs) => {
          const orders = [entryLeg, ...triggerLegs]
          const hasProtection = triggerLegs.length > 0
          const grouping = hasProtection ? GROUPING_NORMAL_TPSL : GROUPING_NONE
          return {
            orders,
            grouping,
            builder: { b: deps.builder.address, f: deps.builder.feeTenthsOfBps },
          }
        }),
      ),
    )
  }

  /** Per-type price validation. Limit / stop-limit need a positive resting
   *  price; both stop variants need a positive `stopPrice`. Market / TWAP carry
   *  no user price. Returns the first violation, or `ok` when valid. */
  function validatePrices(request: PlaceOrderRequest): Result<void, PlaceOrderError> {
    const isLimit = request.orderType === 'limit' || request.orderType === 'stop-limit'
    const isLimitPriceInvalid = isLimit && !(request.price > 0)
    if (isLimitPriceInvalid) {
      return err(new PlaceOrderError('invalid-price', 'limit price must be > 0'))
    }
    const isStopPriceInvalid = isStopRequest(request) && !(request.stopPrice > 0)
    if (isStopPriceInvalid) {
      return err(new PlaceOrderError('invalid-price', 'stop price must be > 0'))
    }
    return ok(undefined)
  }

  function placeOrder(request: PlaceOrderRequest): ResultAsync<PlaceOrderOutcome, PlaceOrderError> {
    const isSizeInvalid = !(request.size > 0)
    if (isSizeInvalid) {
      return errAsync(new PlaceOrderError('invalid-size', 'size must be > 0'))
    }
    const priceValidation = validatePrices(request)
    if (priceValidation.isErr()) return errAsync(priceValidation.error)
    const asset = deps.resolveAsset(request.symbol)
    if (asset === null) {
      return errAsync(new PlaceOrderError('unknown-symbol', `unknown symbol ${request.symbol}`))
    }
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new PlaceOrderError('rejected', 'no approved agent wallet for signing'))
    }

    if (request.orderType === 'twap') {
      return placeTwap(request, asset, agentWallet)
    }
    return placeOrderAction(request, asset, agentWallet)
  }

  /** Market / limit / stop-market / stop-limit → the native HL `order` action. */
  function placeOrderAction(
    request: PlaceOrderRequest,
    asset: HyperliquidAssetInfo,
    agentWallet: NonNullable<ReturnType<HyperliquidTraderDeps['getAgentWallet']>>,
  ): ResultAsync<PlaceOrderOutcome, PlaceOrderError> {
    const cloid = request.clientOrderId as `0x${string}` | undefined
    const paramsResult = buildOrderParams(request, asset, cloid)
    if (paramsResult.isErr()) return errAsync(paramsResult.error)

    const acknowledgedAt = Date.now()
    log.debug({ symbol: request.symbol, orderType: request.orderType }, 'place')
    return deps.exchangeGateway
      .placeOrder(agentWallet, paramsResult.value)
      .mapErr((error: HyperliquidGatewayError) => new PlaceOrderError('rejected', error.message))
      .andThen((response) => {
        const base = buildOutcomeBase(request.symbol, request.clientOrderId, acknowledgedAt)
        const unpacked = unpackOrderResponse(response, base)
        if (unpacked instanceof PlaceOrderError) return err(unpacked)
        return ok(unpacked)
      })
  }

  /** TWAP → the native HL `twapOrder` action (ADR-0034 D-3). `durationMinutes`
   *  maps to `m` (clamped 5..1440), `randomize` to `t`, `reduceOnly` to `r`.
   *  The total `size` is sliced server-side over the duration. Agent-signed. */
  function placeTwap(
    request: TwapOrderRequest,
    asset: HyperliquidAssetInfo,
    agentWallet: NonNullable<ReturnType<HyperliquidTraderDeps['getAgentWallet']>>,
  ): ResultAsync<PlaceOrderOutcome, PlaceOrderError> {
    const paramsResult = buildTwapParams(request, asset)
    if (paramsResult.isErr()) return errAsync(paramsResult.error)

    const acknowledgedAt = Date.now()
    log.debug({ symbol: request.symbol, orderType: request.orderType }, 'place')
    return deps.exchangeGateway
      .placeTwapOrder(agentWallet, paramsResult.value)
      .mapErr((error: HyperliquidGatewayError) => new PlaceOrderError('rejected', error.message))
      .andThen((response) => {
        const base = buildOutcomeBase(request.symbol, request.clientOrderId, acknowledgedAt)
        const unpacked = unpackTwapResponse(response, base)
        if (unpacked instanceof PlaceOrderError) return err(unpacked)
        return ok(unpacked)
      })
  }

  function buildTwapParams(
    request: TwapOrderRequest,
    asset: HyperliquidAssetInfo,
  ): Result<TwapOrderParameters, PlaceOrderError> {
    const clampedMinutes = clampTwapMinutes(
      request.durationMinutes,
      TWAP_MIN_DURATION_MINUTES,
      TWAP_MAX_DURATION_MINUTES,
    )
    return roundSize(request.size, asset).map((s) => ({
      twap: {
        a: asset.assetId,
        b: isBuySide(request.side),
        s,
        r: request.reduceOnly ?? false,
        m: clampedMinutes,
        t: request.randomize,
      },
    }))
  }

  function cancelOrder(identifier: OrderIdentifier): ResultAsync<void, CancelOrderError> {
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new CancelOrderError('rejected', 'no approved agent wallet for signing'))
    }
    const orderRef = deps.resolveOrderRef(identifier)
    if (orderRef === null) {
      return errAsync(new CancelOrderError('not-found', `resting order ${identifier} not found`))
    }
    log.debug({ symbol: orderRef.symbol }, 'cancel')
    return deps.exchangeGateway
      .cancelOrder(agentWallet, { cancels: [{ a: orderRef.assetId, o: orderRef.oid }] })
      .mapErr((error: HyperliquidGatewayError) => new CancelOrderError('rejected', error.message))
      .andThen((response) => {
        // Widen to the raw status union: a `status:"ok"` envelope can still
        // carry a per-cancel `{ error }` (mirrors the order path, PRD dec. 5).
        const statuses = response.response.data.statuses as ReadonlyArray<HyperliquidCancelStatus>
        const status = statuses[0]
        const isError = typeof status === 'object' && status !== null && 'error' in status
        if (isError) return err(new CancelOrderError('rejected', String(status.error)))
        return ok(undefined)
      })
  }

  function modifyOrder(request: ModifyOrderRequest): ResultAsync<PlaceOrderOutcome, ModifyOrderError> {
    const hasInvalidSize = request.size !== undefined && !(request.size > 0)
    if (hasInvalidSize) {
      return errAsync(new ModifyOrderError('invalid-size', 'size must be > 0'))
    }
    const hasInvalidPrice = request.price !== undefined && !(request.price > 0)
    if (hasInvalidPrice) {
      return errAsync(new ModifyOrderError('invalid-price', 'price must be > 0'))
    }
    const agentWallet = deps.getAgentWallet()
    if (agentWallet === null) {
      return errAsync(new ModifyOrderError('rejected', 'no approved agent wallet for signing'))
    }
    const orderRef = deps.resolveOrderRef(request.identifier)
    if (orderRef === null) {
      return errAsync(new ModifyOrderError('not-found', `resting order ${request.identifier} not found`))
    }
    const asset = deps.resolveAsset(orderRef.symbol)
    if (asset === null) {
      return errAsync(new ModifyOrderError('not-found', `unknown symbol ${orderRef.symbol}`))
    }
    return buildModifyParams(request, orderRef, asset).asyncAndThen((params) => {
      const acknowledgedAt = Date.now()
      log.debug({ symbol: orderRef.symbol }, 'modify')
      return deps.exchangeGateway
        .modifyOrder(agentWallet, params)
        .mapErr((error: HyperliquidGatewayError) => new ModifyOrderError('rejected', error.message))
        .map(
          (): PlaceOrderOutcome => ({
            kind: 'resting',
            orderIdentifier: request.identifier,
            symbol: orderRef.symbol,
            timestamp: acknowledgedAt,
          }),
        )
    })
  }

  /** HL `modify` replaces the whole order; the missing leg fields fall back to
   *  the resting order via `resolveOrderRef`. We only carry price/size changes,
   *  so unchanged fields reuse the ref's known values. */
  function buildModifyParams(
    request: ModifyOrderRequest,
    orderRef: HyperliquidOrderRef,
    asset: HyperliquidAssetInfo,
  ): Result<ModifyParameters, ModifyOrderError> {
    const nextPrice = request.price ?? orderRef.price
    const nextSize = request.size ?? orderRef.size
    return deps.exchangeGateway
      .formatPrice(nextPrice, asset.szDecimals, asset.marketType)
      .mapErr((error) => new ModifyOrderError('invalid-price', error.message))
      .andThen((p) =>
        deps.exchangeGateway
          .formatSize(nextSize, asset.szDecimals)
          .mapErr((error) => new ModifyOrderError('invalid-size', error.message))
          .map((s) => ({
            oid: orderRef.oid,
            order: {
              a: asset.assetId,
              b: isBuySide(orderRef.side),
              p,
              s,
              r: orderRef.reduceOnly,
              t: { limit: { tif: 'Gtc' as const } },
            },
          })),
      )
  }

  return {
    supportsTriggerOrders: true,
    supportsStopOrders: true,
    supportsTwap: true,
    placeOrder,
    cancelOrder,
    modifyOrder,
  }
}
