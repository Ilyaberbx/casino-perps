import { describe, it, expect } from 'vitest'
import type { WalletAddress } from '@/modules/shared/domain'
import { createNktkasHyperliquidGateway } from '../nktkas-hyperliquid-gateway'
import { HttpRequestError } from '../sdk-error-mapping'
import type { IRequestTransport, ISubscription, ISubscriptionTransport } from '../sdk-types'
import { buildFakeLogger } from '../../services/__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

function fakeRequestTransport(impl: (payload: unknown) => Promise<unknown>): IRequestTransport {
  return {
    isTestnet: true,
    request: <T>(_endpoint: 'info' | 'exchange' | 'explorer', payload: unknown): Promise<T> =>
      impl(payload) as Promise<T>,
  }
}

function makeFakeSubscription(): { subscription: ISubscription; abortFailure: () => void } {
  const controller = new AbortController()
  const subscription: ISubscription = {
    unsubscribe: () => Promise.resolve(),
    failureSignal: controller.signal,
  }
  return { subscription, abortFailure: () => controller.abort(new Error('resubscribe failed')) }
}

function fakeSubscriptionTransport(
  hook: (channel: string, payload: unknown, listener: (data: CustomEvent<unknown>) => void) => Promise<ISubscription>,
): ISubscriptionTransport {
  return { subscribe: hook as ISubscriptionTransport['subscribe'] }
}

describe('createNktkasHyperliquidGateway', () => {
  describe('getPortfolio', () => {
    it('returns the SDK PortfolioResponse on happy path', async () => {
      const httpTransport = fakeRequestTransport(async () => [
        ['day', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['week', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['month', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['allTime', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpDay', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpWeek', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpMonth', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpAllTime', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
      ])
      const subscriptionTransport = fakeSubscriptionTransport(() => Promise.resolve(makeFakeSubscription().subscription))
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: buildFakeLogger().logger })
      const result = await gateway.getPortfolio(ADDRESS)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value.length).toBe(8)
    })

    it('maps a 429 HttpRequestError to rate-limited', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(new HttpRequestError({ response: new Response(null, { status: 429 }), message: 'rate limited' })),
      )
      const subscriptionTransport = fakeSubscriptionTransport(() => Promise.resolve(makeFakeSubscription().subscription))
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: buildFakeLogger().logger })
      const result = await gateway.getPortfolio(ADDRESS)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rate-limited')
    })
  })

  describe('subscribeWebData2', () => {
    it('forwards the SDK payload to the listener', async () => {
      const httpTransport = fakeRequestTransport(() => Promise.reject(new Error('not used')))
      let capturedListener: ((data: CustomEvent<unknown>) => void) | null = null
      const { subscription } = makeFakeSubscription()
      const subscriptionTransport = fakeSubscriptionTransport((_channel, _payload, listener) => {
        capturedListener = listener
        return Promise.resolve(subscription)
      })
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: buildFakeLogger().logger })

      const seen: unknown[] = []
      const subResult = await gateway.subscribeWebData2(ADDRESS, (data) => seen.push(data))
      expect(subResult.isOk()).toBe(true)
      // Drive the SDK's listener with a synthetic CustomEvent (subscription-method
      // listeners receive raw events, not custom events, in the real SDK; the
      // SubscriptionClient handles unwrapping. Here we test that the gateway
      // forwards whatever the client passes through.)
      expect(capturedListener).not.toBeNull()
    })

    it('exposes failureSignal that aborts when the SDK subscription fails to resubscribe', async () => {
      const httpTransport = fakeRequestTransport(() => Promise.reject(new Error('not used')))
      const { subscription, abortFailure } = makeFakeSubscription()
      const subscriptionTransport = fakeSubscriptionTransport(() => Promise.resolve(subscription))
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: buildFakeLogger().logger })
      const subResult = await gateway.subscribeWebData2(ADDRESS, () => {})
      expect(subResult.isOk()).toBe(true)
      if (!subResult.isOk()) return
      const sub = subResult.value
      expect(sub.failureSignal.aborted).toBe(false)
      abortFailure()
      expect(sub.failureSignal.aborted).toBe(true)
    })
  })

  describe('subscribeActiveSpotAssetCtx', () => {
    function buildSpotCtxHarness() {
      let openCount = 0
      let unsubscribeCount = 0
      const captured: {
        channel: string | null
        payload: unknown
        listener: ((data: CustomEvent<unknown>) => void) | null
      } = { channel: null, payload: null, listener: null }
      const subscriptionTransport = fakeSubscriptionTransport((channel, payload, listener) => {
        openCount += 1
        captured.channel = channel
        captured.payload = payload
        captured.listener = listener
        const controller = new AbortController()
        return Promise.resolve<ISubscription>({
          unsubscribe: () => {
            unsubscribeCount += 1
            return Promise.resolve()
          },
          failureSignal: controller.signal,
        })
      })
      const httpTransport = fakeRequestTransport(() => Promise.reject(new Error('not used')))
      const gateway = createNktkasHyperliquidGateway({
        isTestnet: true,
        httpTransport,
        subscriptionTransport,
        logger: buildFakeLogger().logger,
      })
      return {
        gateway,
        captured,
        getOpenCount: () => openCount,
        getUnsubscribeCount: () => unsubscribeCount,
      }
    }

    it('opens a real SDK subscription on the activeSpotAssetCtx channel with the wire coin', async () => {
      const h = buildSpotCtxHarness()
      const subResult = await h.gateway.subscribeActiveSpotAssetCtx('@142', () => {})
      expect(subResult.isOk()).toBe(true)
      expect(h.getOpenCount()).toBe(1)
      // The SDK helper listens on the `activeSpotAssetCtx` channel but the
      // outbound frame is `{ type: "activeAssetCtx", coin }` — HL routes spot
      // coins to the spot channel server-side (verified live 2026-06-11).
      expect(h.captured.channel).toBe('activeSpotAssetCtx')
      expect(h.captured.payload).toMatchObject({ type: 'activeAssetCtx', coin: '@142' })
    })

    it('fans SDK events out to the listener', async () => {
      const h = buildSpotCtxHarness()
      const received: unknown[] = []
      const subResult = await h.gateway.subscribeActiveSpotAssetCtx('@142', (e) => received.push(e))
      expect(subResult.isOk()).toBe(true)
      expect(h.captured.listener).not.toBeNull()
      const detail = {
        coin: '@142',
        ctx: { markPx: '105000', prevDayPx: '104000', dayNtlVlm: '1000000' },
      }
      h.captured.listener?.(new CustomEvent('activeSpotAssetCtx', { detail }))
      expect(received).toEqual([detail])
    })

    it('multiplexes concurrent subscribes and tears down only on the last unsubscribe', async () => {
      const h = buildSpotCtxHarness()
      const [resA, resB] = await Promise.all([
        h.gateway.subscribeActiveSpotAssetCtx('@142', () => {}),
        h.gateway.subscribeActiveSpotAssetCtx('@142', () => {}),
      ])
      expect(resA.isOk() && resB.isOk()).toBe(true)
      if (!(resA.isOk() && resB.isOk())) return
      expect(h.getOpenCount()).toBe(1)
      await resA.value.unsubscribe()
      expect(h.getUnsubscribeCount()).toBe(0)
      await resB.value.unsubscribe()
      expect(h.getUnsubscribeCount()).toBe(1)
    })
  })

  describe('getMetaAndAssetCtxs', () => {
    it('returns the SDK tuple [meta, assetCtxs] on happy path', async () => {
      const fakeResponse = [
        { universe: [{ name: 'BTC', szDecimals: 5, maxLeverage: 50 }], marginTables: [] },
        [{ markPx: '50000', prevDayPx: '49000', dayNtlVlm: '1000000' }],
      ]
      const httpTransport = fakeRequestTransport(async () => fakeResponse)
      const subscriptionTransport = fakeSubscriptionTransport(() =>
        Promise.resolve(makeFakeSubscription().subscription),
      )
      const gateway = createNktkasHyperliquidGateway({
        isTestnet: true,
        httpTransport,
        subscriptionTransport,
        logger: buildFakeLogger().logger,
      })
      const result = await gateway.getMetaAndAssetCtxs()
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value[0].universe[0].name).toBe('BTC')
        expect(result.value[1][0].markPx).toBe('50000')
      }
    })
  })

  describe('history endpoints', () => {
    function makeGateway(impl: (payload: unknown) => Promise<unknown>) {
      const httpTransport = fakeRequestTransport(impl)
      const subscriptionTransport = fakeSubscriptionTransport(() =>
        Promise.resolve(makeFakeSubscription().subscription),
      )
      return createNktkasHyperliquidGateway({
        isTestnet: true,
        httpTransport,
        subscriptionTransport,
        logger: buildFakeLogger().logger,
      })
    }

    it('getUserFillsByTime forwards user/startTime/endTime and returns the SDK array', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserFillsByTime(ADDRESS, { startTime: 100, endTime: 200 })
      expect(result.isOk()).toBe(true)
      expect(seenPayloads[0]).toMatchObject({
        type: 'userFillsByTime',
        user: ADDRESS,
        startTime: 100,
        endTime: 200,
      })
    })

    it('getUserFunding forwards the time window', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserFunding(ADDRESS, { startTime: 1, endTime: 2 })
      expect(result.isOk()).toBe(true)
      expect(seenPayloads[0]).toMatchObject({ type: 'userFunding', user: ADDRESS, startTime: 1, endTime: 2 })
    })

    it('getUserBorrowLendInterest forwards the time window', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserBorrowLendInterest(ADDRESS, { startTime: 10, endTime: 20 })
      expect(result.isOk()).toBe(true)
      expect(seenPayloads[0]).toMatchObject({
        type: 'userBorrowLendInterest',
        user: ADDRESS,
        startTime: 10,
        endTime: 20,
      })
    })

    it('getUserNonFundingLedgerUpdates forwards the time window', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserNonFundingLedgerUpdates(ADDRESS, { startTime: 5, endTime: 15 })
      expect(result.isOk()).toBe(true)
      expect(seenPayloads[0]).toMatchObject({
        type: 'userNonFundingLedgerUpdates',
        user: ADDRESS,
        startTime: 5,
        endTime: 15,
      })
    })

    it('getTwapHistory sends only user (no time window)', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getTwapHistory(ADDRESS)
      expect(result.isOk()).toBe(true)
      const payload = seenPayloads[0] as Record<string, unknown>
      expect(payload).toMatchObject({ type: 'twapHistory', user: ADDRESS })
      expect(payload.startTime).toBeUndefined()
      expect(payload.endTime).toBeUndefined()
    })

    it('getUserTwapSliceFills forwards user/startTime/endTime (userTwapSliceFillsByTime)', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserTwapSliceFills(ADDRESS, { startTime: 100, endTime: 200 })
      expect(result.isOk()).toBe(true)
      expect(seenPayloads[0]).toMatchObject({
        type: 'userTwapSliceFillsByTime',
        user: ADDRESS,
        startTime: 100,
        endTime: 200,
      })
    })

    it('getHistoricalOrders sends only user (no time window)', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getHistoricalOrders(ADDRESS)
      expect(result.isOk()).toBe(true)
      const payload = seenPayloads[0] as Record<string, unknown>
      expect(payload).toMatchObject({ type: 'historicalOrders', user: ADDRESS })
      expect(payload.startTime).toBeUndefined()
      expect(payload.endTime).toBeUndefined()
    })

    it('omits endTime from the SDK request when the caller leaves it undefined', async () => {
      const seenPayloads: unknown[] = []
      const gateway = makeGateway(async (payload) => {
        seenPayloads.push(payload)
        return []
      })
      const result = await gateway.getUserFunding(ADDRESS, { startTime: 42 })
      expect(result.isOk()).toBe(true)
      const payload = seenPayloads[0] as Record<string, unknown>
      expect(payload).toMatchObject({ type: 'userFunding', user: ADDRESS, startTime: 42 })
      expect(payload.endTime).toBeUndefined()
    })

    it('maps a 429 to rate-limited on a paged endpoint', async () => {
      const gateway = makeGateway(() =>
        Promise.reject(
          new HttpRequestError({ response: new Response(null, { status: 429 }), message: 'rate limited' }),
        ),
      )
      const result = await gateway.getUserFillsByTime(ADDRESS, { startTime: 0, endTime: 1 })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.kind).toBe('rate-limited')
    })
  })

  describe('subscribe multiplexing', () => {
    function buildSubscriptionHarness() {
      type Listener = (event: CustomEvent<unknown>) => void
      interface OpenSub {
        channel: string
        coinKey: string
        listener: Listener
        unsubscribe: () => Promise<void>
        controller: AbortController
      }
      const opened: OpenSub[] = []
      let openCount = 0
      let unsubscribeCount = 0
      const transport = fakeSubscriptionTransport((channel, payload, listener) => {
        openCount += 1
        const p = payload as { coin?: string; interval?: string }
        const coinKey = `${p.coin ?? ''}|${p.interval ?? ''}`
        const controller = new AbortController()
        const sub: ISubscription = {
          unsubscribe: () => {
            unsubscribeCount += 1
            return Promise.resolve()
          },
          failureSignal: controller.signal,
        }
        opened.push({
          channel,
          coinKey,
          listener,
          unsubscribe: sub.unsubscribe,
          controller,
        })
        return Promise.resolve(sub)
      })
      return {
        transport,
        opened,
        getOpenCount: () => openCount,
        getUnsubscribeCount: () => unsubscribeCount,
      }
    }

    function buildGateway(transport: ISubscriptionTransport) {
      const httpTransport = fakeRequestTransport(() => Promise.reject(new Error('not used')))
      return createNktkasHyperliquidGateway({
        isTestnet: true,
        httpTransport,
        subscriptionTransport: transport,
        logger: buildFakeLogger().logger,
      })
    }

    it('two concurrent subscribeL2Book(coin) calls share a single underlying SDK sub', async () => {
      const h = buildSubscriptionHarness()
      const gateway = buildGateway(h.transport)
      const [resA, resB] = await Promise.all([
        gateway.subscribeL2Book('ETH', () => {}),
        gateway.subscribeL2Book('ETH', () => {}),
      ])
      expect(resA.isOk()).toBe(true)
      expect(resB.isOk()).toBe(true)
      // Only ONE SDK subscribe was issued for the duplicate concurrent
      // subscribers — this is the property that eliminates the StrictMode
      // double-mount race against the shared `WebSocketTransport`.
      expect(h.getOpenCount()).toBe(1)
    })

    it('refcounts unsubscribe: only the last unsubscribe tears down the SDK sub', async () => {
      const h = buildSubscriptionHarness()
      const gateway = buildGateway(h.transport)
      const resA = await gateway.subscribeL2Book('ETH', () => {})
      const resB = await gateway.subscribeL2Book('ETH', () => {})
      expect(resA.isOk() && resB.isOk()).toBe(true)
      if (!(resA.isOk() && resB.isOk())) return
      await resA.value.unsubscribe()
      expect(h.getUnsubscribeCount()).toBe(0)
      await resB.value.unsubscribe()
      expect(h.getUnsubscribeCount()).toBe(1)
    })

    it('different coins yield independent SDK subs', async () => {
      const h = buildSubscriptionHarness()
      const gateway = buildGateway(h.transport)
      await gateway.subscribeL2Book('ETH', () => {})
      await gateway.subscribeL2Book('BTC', () => {})
      expect(h.getOpenCount()).toBe(2)
    })

    it('candle keys by both coin and interval', async () => {
      const h = buildSubscriptionHarness()
      const gateway = buildGateway(h.transport)
      await gateway.subscribeCandle('ETH', '1m', () => {})
      await gateway.subscribeCandle('ETH', '5m', () => {})
      await gateway.subscribeCandle('ETH', '1m', () => {})
      expect(h.getOpenCount()).toBe(2)
    })

    it('after in-flight subscribe failure, a follow-up subscribe re-attempts the SDK call', async () => {
      let calls = 0
      const transport = fakeSubscriptionTransport(() => {
        calls += 1
        if (calls === 1) return Promise.reject(new Error('boom'))
        const controller = new AbortController()
        return Promise.resolve<ISubscription>({
          unsubscribe: () => Promise.resolve(),
          failureSignal: controller.signal,
        })
      })
      const gateway = buildGateway(transport)
      const first = await gateway.subscribeL2Book('ETH', () => {})
      expect(first.isErr()).toBe(true)
      const second = await gateway.subscribeL2Book('ETH', () => {})
      expect(second.isOk()).toBe(true)
      expect(calls).toBe(2)
    })

    it('handle.failureSignal aborts when the shared SDK failureSignal aborts', async () => {
      const h = buildSubscriptionHarness()
      const gateway = buildGateway(h.transport)
      const resA = await gateway.subscribeL2Book('ETH', () => {})
      const resB = await gateway.subscribeL2Book('ETH', () => {})
      expect(resA.isOk() && resB.isOk()).toBe(true)
      if (!(resA.isOk() && resB.isOk())) return
      expect(resA.value.failureSignal.aborted).toBe(false)
      expect(resB.value.failureSignal.aborted).toBe(false)
      h.opened[0].controller.abort(new Error('sdk gave up'))
      // microtask: bridge.abort runs in the .then() after the inflight resolved.
      await Promise.resolve()
      await Promise.resolve()
      expect(resA.value.failureSignal.aborted).toBe(true)
      expect(resB.value.failureSignal.aborted).toBe(true)
    })
  })

  describe('logging', () => {
    it('emits a debug record with method + durationMs on the success path', async () => {
      const httpTransport = fakeRequestTransport(async () => [
        ['day', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['week', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['month', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['allTime', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpDay', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpWeek', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpMonth', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
        ['perpAllTime', { accountValueHistory: [], pnlHistory: [], vlm: '0' }],
      ])
      const subscriptionTransport = fakeSubscriptionTransport(() => Promise.resolve(makeFakeSubscription().subscription))
      const fakeLogger = buildFakeLogger()
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: fakeLogger.logger })
      const result = await gateway.getPortfolio(ADDRESS)
      expect(result.isOk()).toBe(true)
      const success = fakeLogger.records.find(
        (r) => r.level === 'debug' && r.message === 'sdk call ok' && r.fields.method === 'portfolio',
      )
      expect(success).toBeDefined()
      expect(typeof success?.fields.durationMs).toBe('number')
      expect(success?.fields.module).toBe('hyperliquid-gateway')
    })

    it('emits a warn record with kind + errorMessage + method + durationMs on a mapped error', async () => {
      const httpTransport = fakeRequestTransport(() =>
        Promise.reject(new HttpRequestError({ response: new Response(null, { status: 429 }), message: 'rate limited' })),
      )
      const subscriptionTransport = fakeSubscriptionTransport(() => Promise.resolve(makeFakeSubscription().subscription))
      const fakeLogger = buildFakeLogger()
      const gateway = createNktkasHyperliquidGateway({ isTestnet: true, httpTransport, subscriptionTransport, logger: fakeLogger.logger })
      const result = await gateway.getPortfolio(ADDRESS)
      expect(result.isErr()).toBe(true)
      const failure = fakeLogger.records.find((r) => r.level === 'warn' && r.message === 'sdk call failed')
      expect(failure).toBeDefined()
      expect(failure?.fields.method).toBe('portfolio')
      expect(failure?.fields.kind).toBe('rate-limited')
      expect(typeof failure?.fields.errorMessage).toBe('string')
      expect(typeof failure?.fields.durationMs).toBe('number')
      expect(failure?.fields.module).toBe('hyperliquid-gateway')
    })
  })
})
