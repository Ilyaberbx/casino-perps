import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { createWebData2Stream } from '../web-data2-stream'
import {
  HyperliquidGatewayError,
  type HyperliquidGateway,
  type HyperliquidSubscription,
} from '../../gateway'
import type { WebData2Response } from '../../gateway/sdk-types'
import { buildFakeLogger } from '../__fixtures__/web-data2'

const ADDR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as WalletAddress
const ADDR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as WalletAddress

function fakeWebData2(user: `0x${string}`): WebData2Response {
  return {
    clearinghouseState: {
      marginSummary: { accountValue: '0', totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
      crossMarginSummary: { accountValue: '0', totalNtlPos: '0', totalRawUsd: '0', totalMarginUsed: '0' },
      crossMaintenanceMarginUsed: '0',
      withdrawable: '0',
      assetPositions: [],
      time: 0,
    },
    leadingVaults: [],
    totalVaultEquity: '0',
    openOrders: [],
    agentAddress: null,
    agentValidUntil: null,
    cumLedger: '0',
    meta: { universe: [], marginTables: [] },
    assetCtxs: [],
    serverTime: 0,
    isVault: false,
    user,
    twapStates: [],
    spotState: { balances: [], evmEscrows: [] },
    spotAssetCtxs: [],
  } as unknown as WebData2Response
}

function makeFakeSubscription(
  reason: unknown = new Error('fail'),
): HyperliquidSubscription & { abortFailure: () => void } {
  const controller = new AbortController()
  return {
    unsubscribe: () => Promise.resolve(),
    failureSignal: controller.signal,
    abortFailure: () => controller.abort(reason),
  }
}

interface FakeGateway {
  gateway: HyperliquidGateway
  invokeListener(data: WebData2Response): void
  subscribeCalls(): number
}

function fakeGateway(opts: {
  resolve?: () => HyperliquidSubscription
  reject?: () => HyperliquidGatewayError
} = {}): FakeGateway {
  let capturedListener: ((data: WebData2Response) => void) | null = null
  let subscribeCalls = 0
  const gateway: HyperliquidGateway = {
    fetchWebData2: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getPortfolio: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserFees: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getDelegatorSummary: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getSpotMetaAndAssetCtxs: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getMetaAndAssetCtxs: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getPerpMetaAndAssetCtxs: () =>
      errAsync(new HyperliquidGatewayError('network', 'not used')),
    getPerpDexs: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getAllPerpMetas: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getCandleSnapshot: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeCandle: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeL2Book: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeTradesStream: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeActiveAssetCtx: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeActiveSpotAssetCtx: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getBorrowLendUserState: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserFillsByTime: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserFunding: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserBorrowLendInterest: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserNonFundingLedgerUpdates: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getTwapHistory: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getUserTwapSliceFills: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    getHistoricalOrders: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    queryUserAbstraction: () => errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeAllDexsClearinghouseState: () =>
      errAsync(new HyperliquidGatewayError('network', 'not used')),
    subscribeWebData2: (_addr, listener) => {
      subscribeCalls++
      capturedListener = listener
      if (opts.reject) return errAsync(opts.reject())
      const sub = opts.resolve ? opts.resolve() : makeFakeSubscription()
      return okAsync(sub)
    },
  }
  return {
    gateway,
    invokeListener: (data) => capturedListener?.(data),
    subscribeCalls: () => subscribeCalls,
  }
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('createWebData2Stream', () => {
  it('starts in disconnected and stays disconnected with no listeners or no address', () => {
    const gw = fakeGateway()
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => null, logger: buildFakeLogger().logger })
    expect(stream.connectionStatus.status()).toBe('disconnected')
    expect(stream.current()).toBeNull()
  })

  it('subscribes once for N data listeners and emits to all of them', async () => {
    const gw = fakeGateway()
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => ADDR_A, logger: buildFakeLogger().logger })
    const seenA: WebData2Response[] = []
    const seenB: WebData2Response[] = []
    stream.subscribe((s) => seenA.push(s))
    stream.subscribe((s) => seenB.push(s))
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(1)
    gw.invokeListener(fakeWebData2(ADDR_A))
    expect(seenA).toHaveLength(1)
    expect(seenB).toHaveLength(1)
  })

  it('transitions disconnected → connecting → connected as soon as subscribe resolves, before any data arrives', async () => {
    const gw = fakeGateway()
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => ADDR_A, logger: buildFakeLogger().logger })
    const seen: string[] = []
    stream.connectionStatus.subscribe((s) => seen.push(s))
    stream.subscribe(() => {})
    expect(stream.connectionStatus.status()).toBe('connecting')
    await flushMicrotasks()
    // Subscribe-promise has resolved; status must flip without waiting for
    // the first data tick — otherwise the indicator (and any downstream
    // `connected`-gated consumer) gets stuck on `connecting` whenever the
    // channel is briefly quiet.
    expect(stream.connectionStatus.status()).toBe('connected')
    gw.invokeListener(fakeWebData2(ADDR_A))
    expect(stream.connectionStatus.status()).toBe('connected')
    // The status source replays the current status on subscribe (level-
    // triggered): this subscriber attached while `disconnected`, so it sees
    // `disconnected` first, then the `connecting` → `connected` transitions.
    expect(seen).toEqual(['disconnected', 'connecting', 'connected'])
  })

  it('replays the current status to a late subscriber that subscribes after connect', async () => {
    // A subscriber can attach AFTER the shared webData2 connection is already
    // `connected` — e.g. the account dock behind a lazy route chunk / auth gate.
    // A status source that only notifies on *change* leaves that late subscriber
    // ignorant of the current `connected` state. Every other status source in
    // the app (mock-venue's `connection`, the connection-supervisor) replays the
    // current status on subscribe; webData2 must match that contract (and its
    // own data `subscribe`, which already replays `latest`).
    const gw = fakeGateway()
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => ADDR_A, logger: buildFakeLogger().logger })
    stream.subscribe(() => {})
    await flushMicrotasks()
    expect(stream.connectionStatus.status()).toBe('connected')

    const seen: string[] = []
    stream.connectionStatus.subscribe((s) => seen.push(s))
    expect(seen).toEqual(['connected'])
  })

  it('transitions to reconnecting when failureSignal aborts mid-stream (self-heals)', async () => {
    const sub = makeFakeSubscription()
    const gw = fakeGateway({ resolve: () => sub })
    // Capture the retry timer so the test stays deterministic; never fire it.
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(fakeWebData2(ADDR_A))
    expect(stream.connectionStatus.status()).toBe('connected')
    sub.abortFailure()
    // ADR-0010 amendment (2026-05-20): the stream now self-heals via
    // `withReconnect`. After the first successful subscribe, a failureSignal
    // abort transitions to `reconnecting` (amber) rather than terminal `error`.
    expect(stream.connectionStatus.status()).toBe('reconnecting')
  })

  it('transitions to error when the FIRST subscribe-promise rejects (no prior success)', async () => {
    const gw = fakeGateway({ reject: () => new HyperliquidGatewayError('network', 'down') })
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    // hasEverConnected=false on the first failure → status flips to `error`
    // and the retry timer is scheduled (suppressed here via the no-op setTimeout).
    expect(stream.connectionStatus.status()).toBe('error')
  })

  it('tears down + resubscribes on address change', async () => {
    const gw = fakeGateway()
    let currentAddress: WalletAddress | null = ADDR_A
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => currentAddress, logger: buildFakeLogger().logger })
    stream.subscribe(() => {})
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(1)
    currentAddress = ADDR_B
    stream.refreshAddress()
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(2)
  })

  it('invalidates the stale cache on address rotation, so a rerouted subscriber never replays the previous address data', async () => {
    // Regression for the spectate-mode transition flash: acting-account-sources.ts
    // reroutes a live subscriber from one instance onto this one right after an
    // address rotation. Before the fix, subscribe()'s synchronous replay of
    // `latest` handed that new subscriber the PREVIOUS address's data.
    const gw = fakeGateway()
    let currentAddress: WalletAddress | null = ADDR_A
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(fakeWebData2(ADDR_A))
    expect(stream.current()).not.toBeNull()

    currentAddress = ADDR_B
    stream.refreshAddress()

    // The rotation is synchronous; before ADDR_B's tick has arrived over the
    // wire, the cache must already be invalidated — not still serving ADDR_A.
    expect(stream.current()).toBeNull()
    const seen: WebData2Response[] = []
    stream.subscribe((s) => seen.push(s))
    expect(seen).toHaveLength(0)

    gw.invokeListener(fakeWebData2(ADDR_B))
    expect(seen).toHaveLength(1)
    expect(stream.current()?.user).toBe(ADDR_B)
  })

  it('emits structured log records on subscribe, address change, and failureSignal', async () => {
    const sub = makeFakeSubscription()
    const gw = fakeGateway({ resolve: () => sub })
    const fakeLogger = buildFakeLogger()
    let currentAddress: WalletAddress | null = ADDR_A
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: fakeLogger.logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(fakeWebData2(ADDR_A))

    const subscribeRecords = fakeLogger.records.filter(
      (r) => r.message === 'subscribe' && r.level === 'info',
    )
    expect(subscribeRecords.length).toBeGreaterThanOrEqual(1)
    expect(subscribeRecords[0].fields.module).toBe('hyperliquid-stream')
    expect(subscribeRecords[0].fields.to).toMatch(/^0x…/)
    expect(String(subscribeRecords[0].fields.to)).not.toContain('aaaaaaaaaa')

    const tickRecords = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'tick',
    )
    expect(tickRecords.length).toBeGreaterThanOrEqual(1)

    sub.abortFailure()
    // withReconnect emits the failure-signal record under its event label.
    const failureRecords = fakeLogger.records.filter(
      (r) => r.level === 'warn' && r.message === 'webData2 subscribe failure signal',
    )
    expect(failureRecords.length).toBeGreaterThanOrEqual(1)
    expect(failureRecords[0].fields).toHaveProperty('kind', 'failure-signal')
    expect(failureRecords[0].fields.address).toMatch(/^0x…/)
    expect(failureRecords[0].fields).toHaveProperty('errorMessage', 'fail')
    expect(String(failureRecords[0].fields.errorMessage)).not.toContain('aaaaaaaaaa')

    currentAddress = ADDR_B
    stream.refreshAddress()
    await flushMicrotasks()
    const refreshRecords = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'refresh address',
    )
    expect(refreshRecords.length).toBeGreaterThanOrEqual(1)
    expect(refreshRecords[0].fields.from).toMatch(/^0x…/)
    expect(refreshRecords[0].fields.to).toMatch(/^0x…/)
  })

  it('scrubs raw wallet addresses out of failureSignal errorMessage', async () => {
    const rawAddress = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa'
    const sub = makeFakeSubscription(new Error(`unknown user ${rawAddress}`))
    const gw = fakeGateway({ resolve: () => sub })
    const fakeLogger = buildFakeLogger()
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: fakeLogger.logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    sub.abortFailure()

    const failureRecord = fakeLogger.records.find(
      (r) => r.level === 'warn' && r.message === 'webData2 subscribe failure signal',
    )
    expect(failureRecord).toBeDefined()
    const errorMessage = String(failureRecord?.fields.errorMessage ?? '')
    expect(errorMessage).not.toContain(rawAddress)
    expect(errorMessage).not.toContain(rawAddress.toLowerCase())
    expect(errorMessage).toMatch(/0x…[0-9a-f]{4}/)
  })

  it('self-heals back to connected after failureSignal aborts (ADR-0010 amendment)', async () => {
    // First subscribe resolves to a sub we will abort. Second subscribe (the
    // reconnect) resolves to a fresh sub that stays alive.
    const sub1 = makeFakeSubscription()
    const sub2 = makeFakeSubscription()
    const subs = [sub1, sub2]
    const gw = fakeGateway({ resolve: () => subs.shift()! })
    let pendingRetry: (() => void) | null = null
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
      setTimeout: (handler) => {
        pendingRetry = handler
        return 0
      },
      clearTimeout: () => {},
      random: () => 0,
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(fakeWebData2(ADDR_A))
    expect(stream.connectionStatus.status()).toBe('connected')

    sub1.abortFailure()
    expect(stream.connectionStatus.status()).toBe('reconnecting')
    expect(gw.subscribeCalls()).toBe(1)

    // Fire the backoff timer → withReconnect calls subscribe() again.
    pendingRetry!()
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(2)
    expect(stream.connectionStatus.status()).toBe('connected')
  })

  it('reverts to disconnected when address becomes null', () => {
    let currentAddress: WalletAddress | null = ADDR_A
    const gw = fakeGateway()
    const stream = createWebData2Stream({ gateway: gw.gateway, getAddress: () => currentAddress, logger: buildFakeLogger().logger })
    stream.subscribe(() => {})
    currentAddress = null
    stream.refreshAddress()
    expect(stream.connectionStatus.status()).toBe('disconnected')
  })

  it('revives after stop() when refreshAddress is called with a real address', async () => {
    // The bug behind "websockets don't work in the account dock":
    // React 19 StrictMode dev runs effect setup → cleanup → setup on the
    // initial mount, against the *same* useMemo-cached venue. The cleanup
    // calls venue.dispose() → stream.stop() → stream.stopped=true. The
    // re-mount then calls venue.refreshAddress(); if the stream stays
    // permanently stopped, ensureSubscribed bails forever and webData2
    // never subscribes — even after primaryWalletAddress resolves from null
    // to the real wallet. This test locks down the revival semantic.
    let currentAddress: WalletAddress | null = null
    const gw = fakeGateway()
    const stream = createWebData2Stream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
    stream.subscribe(() => {})

    // Simulate StrictMode dispose cleanup: stop the stream before the
    // address resolves.
    stream.stop()
    expect(stream.connectionStatus.status()).toBe('disconnected')
    expect(gw.subscribeCalls()).toBe(0)

    // Privy session restore completes — the address resolves and
    // venue.refreshAddress() is called from App's auth-mirror effect.
    currentAddress = ADDR_A
    stream.refreshAddress()
    await flushMicrotasks()

    // Subscribe MUST have fired against the SDK gateway.
    expect(gw.subscribeCalls()).toBe(1)
    expect(stream.connectionStatus.status()).toBe('connected')
  })
})
