import { describe, it, expect } from 'vitest'
import { ok, okAsync } from 'neverthrow'
import { PlaceOrderError } from '@/modules/shared/domain'
import type {
  LimitOrderRequest,
  MarketOrderRequest,
  StopLimitOrderRequest,
  StopMarketOrderRequest,
  TriggerLeg,
  TwapOrderRequest,
} from '@/modules/shared/domain'
import { buildFakeExchangeGateway } from '../../gateway/__fixtures__/fake-exchange-gateway'
import type {
  HyperliquidExchangeGateway,
  OrderParameters,
  OrderSuccessResponse,
  TwapOrderParameters,
  TwapOrderSuccessResponse,
} from '../../gateway'
import { buildFakeLogger } from '../__fixtures__/web-data2'
import { createHyperliquidTrader } from '../hyperliquid-trader'
import type {
  HyperliquidAssetInfo,
  HyperliquidOrderRef,
  HyperliquidReferencePrice,
  HyperliquidTraderDeps,
} from '../hyperliquid-trader.types'

// A fake agent wallet: the adapter only ever forwards it to the gateway, so an
// opaque marker object suffices (no signing happens with the fake gateway).
const FAKE_AGENT_WALLET = { __fakeAgentWallet: true } as never

const BTC_ASSET: HyperliquidAssetInfo = { assetId: 0, szDecimals: 5, marketType: 'perp' }
const BUILDER = { address: '0xb84168cf3be63c6b8dad05ff5d755e97432ff80b' as `0x${string}`, feeTenthsOfBps: 35 }
const CLOID = `0xa99a${'0'.repeat(28)}` as const

interface TraderHarnessOverrides {
  readonly gateway?: Partial<HyperliquidExchangeGateway>
  readonly resolveAsset?: (symbol: string) => HyperliquidAssetInfo | null
  readonly resolveOrderRef?: (identifier: string) => HyperliquidOrderRef | null
  readonly getReferencePrice?: (symbol: string) => HyperliquidReferencePrice | null
  readonly getAgentWallet?: () => HyperliquidTraderDeps['getAgentWallet'] extends () => infer R ? R : never
}

/**
 * Default format stubs round to the asset's szDecimals (price: round, size:
 * truncate) so the test asserts the adapter routes raw values through the
 * gateway formatters and the rounded strings flow into the params.
 */
function defaultFormatPrice(price: number, szDecimals: number) {
  void szDecimals
  return ok(String(Number(price.toPrecision(5))))
}
function defaultFormatSize(size: number, szDecimals: number) {
  const factor = 10 ** szDecimals
  return ok(String(Math.trunc(size * factor) / factor))
}

function buildTrader(overrides: TraderHarnessOverrides = {}) {
  const captured: { orderParams: OrderParameters[]; twapParams: TwapOrderParameters[] } = {
    orderParams: [],
    twapParams: [],
  }
  const gateway = buildFakeExchangeGateway({
    formatPrice: defaultFormatPrice,
    formatSize: defaultFormatSize,
    placeOrder: (_wallet, params) => {
      captured.orderParams.push(params)
      const okResponse: OrderSuccessResponse = {
        status: 'ok',
        response: { type: 'order', data: { statuses: [{ resting: { oid: 999 } }] } },
      }
      return okAsync(okResponse)
    },
    placeTwapOrder: (_wallet, params) => {
      captured.twapParams.push(params)
      const okResponse: TwapOrderSuccessResponse = {
        status: 'ok',
        response: { type: 'twapOrder', data: { status: { running: { twapId: 4242 } } } },
      }
      return okAsync(okResponse)
    },
    ...overrides.gateway,
  })
  const trader = createHyperliquidTrader({
    exchangeGateway: gateway,
    getAgentWallet: overrides.getAgentWallet ?? (() => FAKE_AGENT_WALLET),
    resolveAsset: overrides.resolveAsset ?? (() => BTC_ASSET),
    resolveOrderRef: overrides.resolveOrderRef ?? (() => null),
    getReferencePrice:
      overrides.getReferencePrice ?? (() => ({ topBid: 99_990, topAsk: 100_010, mark: 100_000 })),
    logger: buildFakeLogger().logger,
    builder: BUILDER,
  })
  return { trader, captured }
}

const marketRequest = (over: Partial<MarketOrderRequest> = {}): MarketOrderRequest => ({
  orderType: 'market',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 0.123_456_789,
  clientOrderId: CLOID,
  ...over,
})

const limitRequest = (over: Partial<LimitOrderRequest> = {}): LimitOrderRequest => ({
  orderType: 'limit',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 1.5,
  price: 95_000,
  timeInForce: 'Gtc',
  clientOrderId: CLOID,
  ...over,
})

const stopMarketRequest = (
  over: Partial<StopMarketOrderRequest> = {},
): StopMarketOrderRequest => ({
  orderType: 'stop-market',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 0.5,
  stopPrice: 105_000,
  clientOrderId: CLOID,
  ...over,
})

const stopLimitRequest = (over: Partial<StopLimitOrderRequest> = {}): StopLimitOrderRequest => ({
  orderType: 'stop-limit',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 0.5,
  stopPrice: 105_000,
  price: 105_100,
  clientOrderId: CLOID,
  ...over,
})

const twapRequest = (over: Partial<TwapOrderRequest> = {}): TwapOrderRequest => ({
  orderType: 'twap',
  symbol: 'BTC-PERP',
  side: 'buy',
  size: 2,
  durationMinutes: 30,
  randomize: false,
  clientOrderId: CLOID,
  ...over,
})

describe('createHyperliquidTrader.placeOrder', () => {
  describe('payload shape', () => {
    it('builds a single order leg with asset id, rounded p/s, reduceOnly, builder, cloid', async () => {
      const { trader, captured } = buildTrader()
      const result = await trader.placeOrder(marketRequest({ reduceOnly: true }))
      expect(result.isOk()).toBe(true)
      expect(captured.orderParams).toHaveLength(1)
      const params = captured.orderParams[0]!
      expect(params.orders).toHaveLength(1)
      const leg = params.orders[0]!
      expect(leg.a).toBe(0)
      expect(leg.b).toBe(true)
      expect(leg.r).toBe(true)
      expect(leg.c).toBe(CLOID)
      // size truncated to 5 szDecimals (0.123456789 → 0.12345)
      expect(leg.s).toBe('0.12345')
      expect(params.builder).toEqual({ b: BUILDER.address, f: 35 })
      expect(params.grouping).toBe('na')
    })

    it('prices a market BUY as an aggressive IOC above top-of-book at default 5% slippage', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(marketRequest())
      const leg = captured.orderParams[0]!.orders[0]!
      // topAsk 100010 × 1.05 = 105010.5 → toPrecision(5) → 105010
      expect(leg.p).toBe('105010')
      expect(leg.t).toEqual({ limit: { tif: 'FrontendMarket' } })
    })

    it('prices a market SELL below top-of-book bid at the slippage tolerance', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(marketRequest({ side: 'sell', slippageTolerance: 0.1 }))
      const leg = captured.orderParams[0]!.orders[0]!
      expect(leg.b).toBe(false)
      // topBid 99990 × 0.9 = 89991
      expect(leg.p).toBe('89991')
    })

    it('falls back to mark when the relevant side of the book is empty', async () => {
      const { trader, captured } = buildTrader({
        getReferencePrice: () => ({ mark: 100_000 }),
      })
      await trader.placeOrder(marketRequest())
      const leg = captured.orderParams[0]!.orders[0]!
      // mark 100000 × 1.05 = 105000
      expect(leg.p).toBe('105000')
    })

    it('builds a limit order leg with the explicit price and time-in-force', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(limitRequest({ timeInForce: 'Alo' }))
      const leg = captured.orderParams[0]!.orders[0]!
      expect(leg.p).toBe('95000')
      expect(leg.t).toEqual({ limit: { tif: 'Alo' } })
      expect(leg.s).toBe('1.5')
    })

    it('attaches TP/SL legs (opposite side, reduce-only) with grouping normalTpsl', async () => {
      const takeProfit: TriggerLeg = { kind: 'take-profit', trigger: { type: 'price', price: 110_000 } }
      const stopLoss: TriggerLeg = { kind: 'stop-loss', trigger: { type: 'percent', percent: 10 } }
      const { trader, captured } = buildTrader()
      await trader.placeOrder(limitRequest({ takeProfit, stopLoss }))
      const params = captured.orderParams[0]!
      expect(params.grouping).toBe('normalTpsl')
      expect(params.orders).toHaveLength(3)
      const tpLeg = params.orders[1]!
      const slLeg = params.orders[2]!
      // closing legs are reduce-only and the opposite side of the long entry
      expect(tpLeg.r).toBe(true)
      expect(tpLeg.b).toBe(false)
      expect('trigger' in tpLeg.t && tpLeg.t.trigger.tpsl).toBe('tp')
      expect('trigger' in tpLeg.t && tpLeg.t.trigger.triggerPx).toBe('110000')
      // SL percent: 10% below the 95000 limit entry for a long → 85500
      expect('trigger' in slLeg.t && slLeg.t.trigger.tpsl).toBe('sl')
      expect('trigger' in slLeg.t && slLeg.t.trigger.triggerPx).toBe('85500')
    })
  })

  describe('statuses[] unpacking', () => {
    it('maps a resting status to a resting outcome carrying the oid + cloid', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () =>
            okAsync({
              status: 'ok',
              response: { type: 'order', data: { statuses: [{ resting: { oid: 4242, cloid: CLOID } }] } },
            } as OrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(limitRequest())
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.kind).toBe('resting')
        expect(result.value.orderIdentifier).toBe('4242')
        expect(result.value.clientOrderId).toBe(CLOID)
      }
    })

    it('maps a filled status to a filled outcome with avgPx + totalSz', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () =>
            okAsync({
              status: 'ok',
              response: {
                type: 'order',
                data: { statuses: [{ filled: { oid: 7, totalSz: '0.5', avgPx: '100250.0' } }] },
              },
            } as OrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(marketRequest())
      expect(result.isOk()).toBe(true)
      if (result.isOk() && result.value.kind === 'filled') {
        expect(result.value.orderIdentifier).toBe('7')
        expect(result.value.filledSize).toBe(0.5)
        expect(result.value.averagePrice).toBe(100_250)
      }
    })

    it('maps a per-order error under status:"ok" to a rejected PlaceOrderError (raw passthrough)', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () =>
            okAsync({
              status: 'ok',
              response: { type: 'order', data: { statuses: [{ error: 'Insufficient margin' }] } },
            } as unknown as OrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(marketRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(PlaceOrderError)
        expect(result.error.kind).toBe('rejected')
        expect(result.error.message).toBe('Insufficient margin')
      }
    })

    it('maps waitingForTrigger to a resting outcome', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () =>
            okAsync({
              status: 'ok',
              response: { type: 'order', data: { statuses: ['waitingForTrigger'] } },
            } as unknown as OrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(limitRequest())
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.kind).toBe('resting')
    })
  })

  describe('validation + guards', () => {
    it('rejects a non-positive size before touching the gateway', async () => {
      const { trader, captured } = buildTrader()
      const result = await trader.placeOrder(marketRequest({ size: 0 }))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-size')
      expect(captured.orderParams).toHaveLength(0)
    })

    it('rejects an unknown symbol', async () => {
      const { trader } = buildTrader({ resolveAsset: () => null })
      const result = await trader.placeOrder(marketRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('unknown-symbol')
    })

    it('rejects when no agent wallet is available for signing', async () => {
      const { trader } = buildTrader({ getAgentWallet: () => null })
      const result = await trader.placeOrder(marketRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rejected')
    })

    it('maps a gateway/transport error to a rejected PlaceOrderError', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () => buildFakeExchangeGateway().placeOrder(FAKE_AGENT_WALLET, { orders: [], grouping: 'na' }),
        },
      })
      const result = await trader.placeOrder(marketRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rejected')
    })
  })

  describe('capability flags (ADR-0034 D-3)', () => {
    it('advertises stop + TWAP support', () => {
      const { trader } = buildTrader()
      expect(trader.supportsStopOrders).toBe(true)
      expect(trader.supportsTwap).toBe(true)
      expect(trader.supportsTriggerOrders).toBe(true)
    })
  })

  describe('stop-market → native trigger order', () => {
    it('builds a market trigger leg: triggerPx = stopPrice, isMarket true, grouping na', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(stopMarketRequest({ stopPrice: 105_000 }))
      expect(captured.orderParams).toHaveLength(1)
      const params = captured.orderParams[0]!
      expect(params.grouping).toBe('na')
      expect(params.orders).toHaveLength(1)
      const leg = params.orders[0]!
      expect(leg.a).toBe(0)
      expect(leg.b).toBe(true)
      expect(leg.c).toBe(CLOID)
      // size truncated to 5 szDecimals
      expect(leg.s).toBe('0.5')
      expect('trigger' in leg.t).toBe(true)
      expect('trigger' in leg.t && leg.t.trigger.isMarket).toBe(true)
      expect('trigger' in leg.t && leg.t.trigger.triggerPx).toBe('105000')
      // builder fee still attached
      expect(params.builder).toEqual({ b: BUILDER.address, f: 35 })
    })

    it('prices the fill leg as an aggressive IOC off top-of-book (like market)', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(stopMarketRequest({ side: 'buy', slippageTolerance: 0.05 }))
      const leg = captured.orderParams[0]!.orders[0]!
      // topAsk 100010 × 1.05 = 105010.5 → toPrecision(5) → 105010
      expect(leg.p).toBe('105010')
    })

    it('derives tpsl from stop price vs mark + side (buy stop above mark ⇒ tp)', async () => {
      const { trader, captured } = buildTrader()
      // mark 100000, buy stop at 105000 (above ⇒ favourable breakout ⇒ tp)
      await trader.placeOrder(stopMarketRequest({ side: 'buy', stopPrice: 105_000 }))
      const leg = captured.orderParams[0]!.orders[0]!
      expect('trigger' in leg.t && leg.t.trigger.tpsl).toBe('tp')
    })

    it('derives tpsl sl when a buy stop sits below the mark (adverse)', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(stopMarketRequest({ side: 'buy', stopPrice: 95_000 }))
      const leg = captured.orderParams[0]!.orders[0]!
      expect('trigger' in leg.t && leg.t.trigger.tpsl).toBe('sl')
    })

    it('maps a resting/waitingForTrigger outcome to a resting PlaceOrderOutcome', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeOrder: () =>
            okAsync({
              status: 'ok',
              response: { type: 'order', data: { statuses: ['waitingForTrigger'] } },
            } as unknown as OrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(stopMarketRequest())
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.kind).toBe('resting')
    })

    it('rejects a non-positive stop price before touching the gateway', async () => {
      const { trader, captured } = buildTrader()
      const result = await trader.placeOrder(stopMarketRequest({ stopPrice: 0 }))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-price')
      expect(captured.orderParams).toHaveLength(0)
    })
  })

  describe('stop-limit → native trigger order', () => {
    it('builds a limit trigger leg: isMarket false, p = limit price, triggerPx = stopPrice', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(stopLimitRequest({ stopPrice: 105_000, price: 105_100 }))
      const leg = captured.orderParams[0]!.orders[0]!
      expect(leg.p).toBe('105100')
      expect('trigger' in leg.t && leg.t.trigger.isMarket).toBe(false)
      expect('trigger' in leg.t && leg.t.trigger.triggerPx).toBe('105000')
      expect(captured.orderParams[0]!.grouping).toBe('na')
    })

    it('rejects a non-positive limit price before touching the gateway', async () => {
      const { trader, captured } = buildTrader()
      const result = await trader.placeOrder(stopLimitRequest({ price: 0 }))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-price')
      expect(captured.orderParams).toHaveLength(0)
    })
  })

  describe('twap → native twapOrder action', () => {
    it('maps the request to the SDK twap params (a/b/s/r/m/t)', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(twapRequest({ side: 'buy', durationMinutes: 30, randomize: true, reduceOnly: true }))
      expect(captured.twapParams).toHaveLength(1)
      // order action is never touched for a TWAP
      expect(captured.orderParams).toHaveLength(0)
      expect(captured.twapParams[0]).toEqual({
        twap: { a: 0, b: true, s: '2', r: true, m: 30, t: true },
      })
    })

    it('clamps duration below the 5-minute floor up to 5', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(twapRequest({ durationMinutes: 1 }))
      expect(captured.twapParams[0]!.twap.m).toBe(5)
    })

    it('clamps duration above the 1440-minute ceiling down to 1440 and floors fractions', async () => {
      const { trader, captured } = buildTrader()
      await trader.placeOrder(twapRequest({ durationMinutes: 5000 }))
      expect(captured.twapParams[0]!.twap.m).toBe(1440)
      const { captured: c2, trader: t2 } = buildTrader()
      await t2.placeOrder(twapRequest({ durationMinutes: 30.9 }))
      expect(c2.twapParams[0]!.twap.m).toBe(30)
    })

    it('maps a running twap to a resting outcome carrying the twapId', async () => {
      const { trader } = buildTrader()
      const result = await trader.placeOrder(twapRequest())
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.kind).toBe('resting')
        expect(result.value.orderIdentifier).toBe('4242')
        expect(result.value.clientOrderId).toBe(CLOID)
      }
    })

    it('maps a per-twap error under status:"ok" to a rejected PlaceOrderError', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeTwapOrder: () =>
            okAsync({
              status: 'ok',
              response: { type: 'twapOrder', data: { status: { error: 'TWAP too small' } } },
            } as unknown as TwapOrderSuccessResponse),
        },
      })
      const result = await trader.placeOrder(twapRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe('rejected')
        expect(result.error.message).toBe('TWAP too small')
      }
    })

    it('maps a gateway/transport error to a rejected PlaceOrderError', async () => {
      const { trader } = buildTrader({
        gateway: {
          placeTwapOrder: () =>
            buildFakeExchangeGateway().placeTwapOrder(FAKE_AGENT_WALLET, {
              twap: { a: 0, b: true, s: '1', r: false, m: 30, t: false },
            }),
        },
      })
      const result = await trader.placeOrder(twapRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rejected')
    })

    it('rejects a non-positive size before touching the gateway', async () => {
      const { trader, captured } = buildTrader()
      const result = await trader.placeOrder(twapRequest({ size: 0 }))
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('invalid-size')
      expect(captured.twapParams).toHaveLength(0)
    })

    it('rejects when no agent wallet is available for signing', async () => {
      const { trader, captured } = buildTrader({ getAgentWallet: () => null })
      const result = await trader.placeOrder(twapRequest())
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rejected')
      expect(captured.twapParams).toHaveLength(0)
    })
  })
})

const ORDER_REF: HyperliquidOrderRef = {
  assetId: 0,
  oid: 555,
  symbol: 'BTC-PERP',
  side: 'buy',
  price: 95_000,
  size: 1.5,
  reduceOnly: false,
}

describe('createHyperliquidTrader.cancelOrder', () => {
  it('cancels by (asset, oid) resolved from the identifier', async () => {
    const captured: { cancels: unknown[] } = { cancels: [] }
    const { trader } = buildTrader({
      resolveOrderRef: () => ORDER_REF,
      gateway: {
        cancelOrder: (_wallet, params) => {
          captured.cancels.push(params)
          return okAsync({
            status: 'ok',
            response: { type: 'cancel', data: { statuses: ['success'] } },
          })
        },
      },
    })
    const result = await trader.cancelOrder('555')
    expect(result.isOk()).toBe(true)
    expect(captured.cancels[0]).toEqual({ cancels: [{ a: 0, o: 555 }] })
  })

  it('returns not-found when the order is no longer resting', async () => {
    const { trader } = buildTrader({ resolveOrderRef: () => null })
    const result = await trader.cancelOrder('999')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('not-found')
  })

  it('maps a per-cancel error under status:"ok" to a rejected CancelOrderError', async () => {
    const { trader } = buildTrader({
      resolveOrderRef: () => ORDER_REF,
      gateway: {
        cancelOrder: () =>
          okAsync({
            status: 'ok',
            response: { type: 'cancel', data: { statuses: [{ error: 'Order was never placed' }] } },
          } as never),
      },
    })
    const result = await trader.cancelOrder('555')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.kind).toBe('rejected')
      expect(result.error.message).toBe('Order was never placed')
    }
  })
})

describe('createHyperliquidTrader.modifyOrder', () => {
  it('rebuilds the order with the new price/size and returns a resting outcome', async () => {
    const captured: { params: unknown[] } = { params: [] }
    const { trader } = buildTrader({
      resolveOrderRef: () => ORDER_REF,
      gateway: {
        formatPrice: defaultFormatPrice,
        formatSize: defaultFormatSize,
        modifyOrder: (_wallet, params) => {
          captured.params.push(params)
          return okAsync({ status: 'ok', response: { type: 'default' } } as never)
        },
      },
    })
    const result = await trader.modifyOrder!({ identifier: '555', price: 96_000, size: 2 })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.kind).toBe('resting')
      expect(result.value.orderIdentifier).toBe('555')
    }
    expect(captured.params[0]).toEqual({
      oid: 555,
      order: { a: 0, b: true, p: '96000', s: '2', r: false, t: { limit: { tif: 'Gtc' } } },
    })
  })

  it('falls back to the resting order price/size for fields not being changed', async () => {
    const captured: { params: Array<{ order: { p: string; s: string } }> } = { params: [] }
    const { trader } = buildTrader({
      resolveOrderRef: () => ORDER_REF,
      gateway: {
        formatPrice: defaultFormatPrice,
        formatSize: defaultFormatSize,
        modifyOrder: (_wallet, params) => {
          captured.params.push(params as { order: { p: string; s: string } })
          return okAsync({ status: 'ok', response: { type: 'default' } } as never)
        },
      },
    })
    await trader.modifyOrder!({ identifier: '555', price: 97_000 })
    expect(captured.params[0]!.order.p).toBe('97000')
    expect(captured.params[0]!.order.s).toBe('1.5')
  })

  it('returns not-found when the order is no longer resting', async () => {
    const { trader } = buildTrader({ resolveOrderRef: () => null })
    const result = await trader.modifyOrder!({ identifier: '999', price: 1 })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('not-found')
  })

  it('rejects an invalid modify size before touching the gateway', async () => {
    const { trader } = buildTrader({ resolveOrderRef: () => ORDER_REF })
    const result = await trader.modifyOrder!({ identifier: '555', size: 0 })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('invalid-size')
  })
})
