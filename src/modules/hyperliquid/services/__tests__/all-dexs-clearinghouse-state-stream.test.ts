import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { createAllDexsClearinghouseStateStream } from '../all-dexs-clearinghouse-state-stream'
import { HyperliquidGatewayError, type HyperliquidSubscription } from '../../gateway'
import type { AllDexsClearinghouseStateEvent } from '../../gateway/sdk-types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'
import { buildAllDexsClearinghouseStateEvent } from '../__fixtures__/all-dexs-clearinghouse-state'

const ADDR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as WalletAddress
const ADDR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as WalletAddress

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

interface FakeStreamGateway {
  gateway: ReturnType<typeof buildFakeGateway>
  invokeListener(data: AllDexsClearinghouseStateEvent): void
  subscribeCalls(): number
}

function fakeGateway(opts: {
  resolve?: () => HyperliquidSubscription
  reject?: () => HyperliquidGatewayError
} = {}): FakeStreamGateway {
  let capturedListener: ((data: AllDexsClearinghouseStateEvent) => void) | null = null
  let subscribeCalls = 0
  const gateway = buildFakeGateway({
    subscribeAllDexsClearinghouseState: (_addr, listener) => {
      subscribeCalls++
      capturedListener = listener
      if (opts.reject) return errAsync(opts.reject())
      const sub = opts.resolve ? opts.resolve() : makeFakeSubscription()
      return okAsync(sub)
    },
  })
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

describe('createAllDexsClearinghouseStateStream', () => {
  it('starts in disconnected and stays disconnected with no listeners or no address', () => {
    const gw = fakeGateway()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => null,
      logger: buildFakeLogger().logger,
    })
    expect(stream.connectionStatus.status()).toBe('disconnected')
    expect(stream.current()).toBeNull()
  })

  it('subscribes once for N data listeners and emits to all of them', async () => {
    const gw = fakeGateway()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
    })
    const seenA: AllDexsClearinghouseStateEvent[] = []
    const seenB: AllDexsClearinghouseStateEvent[] = []
    stream.subscribe((s) => seenA.push(s))
    stream.subscribe((s) => seenB.push(s))
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(1)
    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_A }))
    expect(seenA).toHaveLength(1)
    expect(seenB).toHaveLength(1)
  })

  it('transitions disconnected → connecting → connected as soon as subscribe resolves', async () => {
    const gw = fakeGateway()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
    })
    const seen: string[] = []
    stream.connectionStatus.subscribe((s) => seen.push(s))
    stream.subscribe(() => {})
    expect(stream.connectionStatus.status()).toBe('connecting')
    await flushMicrotasks()
    expect(stream.connectionStatus.status()).toBe('connected')
    expect(seen).toEqual(['connecting', 'connected'])
  })

  it('transitions to reconnecting when failureSignal aborts mid-stream (self-heals)', async () => {
    const sub = makeFakeSubscription()
    const gw = fakeGateway({ resolve: () => sub })
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_A }))
    expect(stream.connectionStatus.status()).toBe('connected')
    sub.abortFailure()
    expect(stream.connectionStatus.status()).toBe('reconnecting')
  })

  it('transitions to error when the FIRST subscribe-promise rejects (no prior success)', async () => {
    const gw = fakeGateway({ reject: () => new HyperliquidGatewayError('network', 'down') })
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: buildFakeLogger().logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    expect(stream.connectionStatus.status()).toBe('error')
  })

  it('tears down + resubscribes on address change', async () => {
    const gw = fakeGateway()
    let currentAddress: WalletAddress | null = ADDR_A
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
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
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_A }))
    expect(stream.current()).not.toBeNull()

    currentAddress = ADDR_B
    stream.refreshAddress()

    // The rotation is synchronous; before ADDR_B's tick has arrived over the
    // wire, the cache must already be invalidated — not still serving ADDR_A.
    expect(stream.current()).toBeNull()
    const seen: AllDexsClearinghouseStateEvent[] = []
    stream.subscribe((s) => seen.push(s))
    expect(seen).toHaveLength(0)

    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_B }))
    expect(seen).toHaveLength(1)
    expect(stream.current()?.user).toBe(ADDR_B)
  })

  it('emits structured log records on subscribe, address change, and failureSignal', async () => {
    const sub = makeFakeSubscription()
    const gw = fakeGateway({ resolve: () => sub })
    const fakeLogger = buildFakeLogger()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => ADDR_A,
      logger: fakeLogger.logger,
      setTimeout: () => 0,
      clearTimeout: () => {},
    })
    stream.subscribe(() => {})
    await flushMicrotasks()
    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_A }))

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
    const failureRecords = fakeLogger.records.filter(
      (r) =>
        r.level === 'warn' &&
        r.message === 'allDexsClearinghouseState subscribe failure signal',
    )
    expect(failureRecords.length).toBeGreaterThanOrEqual(1)
    expect(failureRecords[0].fields).toHaveProperty('kind', 'failure-signal')
    expect(failureRecords[0].fields.address).toMatch(/^0x…/)
    expect(failureRecords[0].fields).toHaveProperty('errorMessage', 'fail')
  })

  it('self-heals back to connected after failureSignal aborts', async () => {
    const sub1 = makeFakeSubscription()
    const sub2 = makeFakeSubscription()
    const subs = [sub1, sub2]
    const gw = fakeGateway({ resolve: () => subs.shift()! })
    let pendingRetry: (() => void) | null = null
    const stream = createAllDexsClearinghouseStateStream({
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
    gw.invokeListener(buildAllDexsClearinghouseStateEvent({ user: ADDR_A }))
    expect(stream.connectionStatus.status()).toBe('connected')

    sub1.abortFailure()
    expect(stream.connectionStatus.status()).toBe('reconnecting')
    expect(gw.subscribeCalls()).toBe(1)

    pendingRetry!()
    await flushMicrotasks()
    expect(gw.subscribeCalls()).toBe(2)
    expect(stream.connectionStatus.status()).toBe('connected')
  })

  it('reverts to disconnected when address becomes null', () => {
    let currentAddress: WalletAddress | null = ADDR_A
    const gw = fakeGateway()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
    stream.subscribe(() => {})
    currentAddress = null
    stream.refreshAddress()
    expect(stream.connectionStatus.status()).toBe('disconnected')
  })

  it('revives after stop() when refreshAddress is called with a real address', async () => {
    let currentAddress: WalletAddress | null = null
    const gw = fakeGateway()
    const stream = createAllDexsClearinghouseStateStream({
      gateway: gw.gateway,
      getAddress: () => currentAddress,
      logger: buildFakeLogger().logger,
    })
    stream.subscribe(() => {})

    stream.stop()
    expect(stream.connectionStatus.status()).toBe('disconnected')
    expect(gw.subscribeCalls()).toBe(0)

    currentAddress = ADDR_A
    stream.refreshAddress()
    await flushMicrotasks()

    expect(gw.subscribeCalls()).toBe(1)
    expect(stream.connectionStatus.status()).toBe('connected')
  })
})
