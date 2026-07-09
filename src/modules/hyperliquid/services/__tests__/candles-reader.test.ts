import { describe, it, expect } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { Candle, CandleUpdate } from '@/modules/shared/domain'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { HyperliquidSubscription } from '../../gateway/hyperliquid-gateway.types'
import type { CandleSnapshotResponse } from '../../gateway/sdk-types'
import { createHyperliquidCandlesReader } from '../candles-reader'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

function buildHistory(): CandleSnapshotResponse {
  return [
    { t: 1_700_000_000_000, T: 1_700_003_600_000, s: 'BTC', i: '1h', o: '50000', c: '50500', h: '50800', l: '49800', v: '12.5', n: 100 },
    { t: 1_700_003_600_000, T: 1_700_007_200_000, s: 'BTC', i: '1h', o: '50500', c: '50300', h: '50900', l: '50100', v: '8.2', n: 80 },
  ] as unknown as CandleSnapshotResponse
}

describe('createHyperliquidCandlesReader', () => {
  it('subscribe emits the snapshot history as one bulk `snapshot` update with domain shape; strips -PERP on gateway call', async () => {
    let snapshotCoin: string | null = null
    let subscribeCoin: string | null = null
    const gateway = buildFakeGateway({
      getCandleSnapshot: (coin) => {
        snapshotCoin = coin
        return okAsync(buildHistory())
      },
      subscribeCandle: (coin) => {
        subscribeCoin = coin
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: buildFakeLogger().logger,
    })

    const received: CandleUpdate[] = []
    reader.subscribe('BTC-PERP', '1h', (u) => received.push(u))

    // Wait a microtask cycle for the async backfill to dispatch.
    await new Promise((r) => setTimeout(r, 0))

    expect(snapshotCoin).toBe('BTC')
    expect(subscribeCoin).toBe('BTC')
    expect(received).toHaveLength(1)
    const snap = received[0]
    expect(snap.kind).toBe('snapshot')
    if (snap.kind !== 'snapshot') throw new Error('expected a snapshot update')
    expect(snap.candles).toHaveLength(2)
    const expectedFirst: Candle = {
      symbol: 'BTC-PERP',
      interval: '1h',
      openTime: 1_700_000_000_000,
      open: 50000,
      high: 50800,
      low: 49800,
      close: 50500,
      volume: 12.5,
    }
    expect(snap.candles[0]).toEqual(expectedFirst)
  })

  it('ADR-0041: refetches and re-emits a fresh snapshot on reconnect (onResync)', async () => {
    let snapshotCalls = 0
    let failureSignal = new AbortController()
    const firstCtl = failureSignal
    const gateway = buildFakeGateway({
      getCandleSnapshot: () => {
        snapshotCalls += 1
        return okAsync(buildHistory())
      },
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: failureSignal.signal,
        }),
    })
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: buildFakeLogger().logger,
      // Run the backoff timer immediately so the reconnect is deterministic.
      setTimeout: (handler) => {
        Promise.resolve().then(handler)
        return 0
      },
    })

    const received: CandleUpdate[] = []
    reader.subscribe('BTC-PERP', '1h', (u) => received.push(u))
    await new Promise((r) => setTimeout(r, 0))
    expect(snapshotCalls).toBe(1)
    expect(received.filter((u) => u.kind === 'snapshot')).toHaveLength(1)

    // Mid-stream drop: hand the next subscribe a fresh signal, then abort the
    // live one. withReconnect reconnects and, being a *re*connect, runs onResync.
    failureSignal = new AbortController()
    firstCtl.abort(new Error('socket closed'))
    for (let i = 0; i < 30; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    expect(snapshotCalls).toBe(2)
    expect(received.filter((u) => u.kind === 'snapshot')).toHaveLength(2)
  })

  it('retries the HTTP backfill up to 3 times on transient network errors, then succeeds', async () => {
    let httpCalls = 0
    const gateway = buildFakeGateway({
      getCandleSnapshot: () => {
        httpCalls += 1
        if (httpCalls < 3) {
          return errAsync(new HyperliquidGatewayError('network', 'Hyperliquid HTTP error: 500')) as ResultAsync<CandleSnapshotResponse, HyperliquidGatewayError>
        }
        return okAsync(buildHistory()) as ResultAsync<CandleSnapshotResponse, HyperliquidGatewayError>
      },
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>,
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: fake.logger,
      // Run the retry delay immediately for tests.
      setTimeout: (handler) => {
        Promise.resolve().then(handler)
        return 0
      },
    })

    const received: CandleUpdate[] = []
    reader.subscribe('BTC', '1h', (u) => received.push(u))

    // Allow all 3 async attempts to settle.
    for (let i = 0; i < 20; i++) await Promise.resolve()

    expect(httpCalls).toBe(3)
    expect(received).toHaveLength(1)
    const snap = received[0]
    expect(snap.kind).toBe('snapshot')
    if (snap.kind === 'snapshot') expect(snap.candles).toHaveLength(2)
    // 'history fetch failed' should NOT have fired since the retry succeeded.
    expect(fake.records.some((r) => r.message === 'history fetch failed')).toBe(false)
  })

  it('gives up and logs `history fetch failed` after exhausting retries', async () => {
    let httpCalls = 0
    const gateway = buildFakeGateway({
      getCandleSnapshot: () => {
        httpCalls += 1
        return errAsync(new HyperliquidGatewayError('network', 'Hyperliquid HTTP error: 500')) as ResultAsync<CandleSnapshotResponse, HyperliquidGatewayError>
      },
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>,
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: fake.logger,
      setTimeout: (handler) => {
        Promise.resolve().then(handler)
        return 0
      },
    })

    reader.subscribe('BTC', '1h', () => {})
    for (let i = 0; i < 20; i++) await Promise.resolve()

    expect(httpCalls).toBe(3)
    expect(fake.records.some((r) => r.message === 'history fetch failed')).toBe(true)
  })

  it('getHistory returns the cached candles after subscribe primes them', async () => {
    const gateway = buildFakeGateway({
      getCandleSnapshot: () => okAsync(buildHistory()),
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }),
    })
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: buildFakeLogger().logger,
    })

    expect(reader.getHistory('BTC', '1h').isOk()).toBe(true)
    // Before subscribe primes the cache, getHistory returns an empty array.
    const before = reader.getHistory('BTC', '1h')
    expect(before.isOk() && before.value).toEqual([])

    reader.subscribe('BTC', '1h', () => {})
    await new Promise((r) => setTimeout(r, 0))

    const after = reader.getHistory('BTC', '1h')
    expect(after.isOk()).toBe(true)
    if (after.isOk()) {
      expect(after.value).toHaveLength(2)
      expect(after.value[0].open).toBe(50000)
    }
  })

  it('STAB-01: drops an out-of-order WS candle so the stream stays ascending by openTime', async () => {
    let wsListener: ((e: unknown) => void) | null = null
    const gateway = buildFakeGateway({
      // No backfill — isolate the live-WS append path.
      getCandleSnapshot: () =>
        errAsync(new HyperliquidGatewayError('network', 'no backfill in this test')),
      subscribeCandle: (_coin, _interval, listener) => {
        wsListener = listener as (e: unknown) => void
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const reader = createHyperliquidCandlesReader({ gateway, logger: buildFakeLogger().logger })

    const received: CandleUpdate[] = []
    reader.subscribe('BTC-PERP', '1h', (u) => received.push(u))
    await new Promise((r) => setTimeout(r, 0))

    const ev = (t: number, c: string) => ({ s: 'BTC', i: '1h', t, o: c, h: c, l: c, c, v: '1', n: 1 })
    wsListener!(ev(1_700_003_600_000, '50500')) // newer
    wsListener!(ev(1_700_000_000_000, '50000')) // stale — must be dropped

    expect(received).toHaveLength(1)
    const first = received[0]
    expect(first.kind).toBe('new')
    if (first.kind === 'new') expect(first.candle.openTime).toBe(1_700_003_600_000)
    // Cached buffer stays monotonic (single ascending candle, stale ignored).
    const cached = reader.getHistory('BTC-PERP', '1h')
    expect(cached.isOk() && cached.value).toHaveLength(1)
  })

  it('loadOlder fetches with endTime, filters to strictly older candles, and prepends to cache', async () => {
    const beforeOpenTime = 1_700_007_200_000
    const olderPage: CandleSnapshotResponse = [
      // Older candles — must be kept.
      { t: 1_699_996_400_000, T: 1_700_000_000_000, s: 'BTC', i: '1h', o: '49000', c: '49500', h: '49600', l: '48800', v: '5', n: 50 },
      { t: 1_700_000_000_000, T: 1_700_003_600_000, s: 'BTC', i: '1h', o: '49500', c: '50000', h: '50200', l: '49400', v: '6', n: 55 },
      // Overlap with current oldest — must be filtered out.
      { t: 1_700_007_200_000, T: 1_700_010_800_000, s: 'BTC', i: '1h', o: '50000', c: '50100', h: '50300', l: '49900', v: '7', n: 60 },
    ] as unknown as CandleSnapshotResponse
    let capturedEndTime: number | undefined
    const gateway = buildFakeGateway({
      // Backfill (no endTime) returns the primed pair; loadOlder (with endTime)
      // returns the older window. Split keeps the cache-merge assertion clean.
      getCandleSnapshot: (_coin, _interval, _start, end) => {
        capturedEndTime = end
        if (end === undefined) return okAsync(buildHistory())
        return okAsync(olderPage)
      },
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }),
    })
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: buildFakeLogger().logger,
    })

    // Prime cache via subscribe so the prepend has a target.
    reader.subscribe('BTC-PERP', '1h', () => {})
    await new Promise((r) => setTimeout(r, 0))

    const result = await reader.loadOlder('BTC-PERP', '1h', beforeOpenTime, 500)
    expect(result.isOk()).toBe(true)
    if (!result.isOk()) return
    expect(capturedEndTime).toBe(beforeOpenTime - 1)
    expect(result.value.candles.map((c) => c.openTime)).toEqual([
      1_699_996_400_000,
      1_700_000_000_000,
    ])
    // Short page (< 500 returned) → reachedStart latches.
    expect(result.value.reachedStart).toBe(true)

    // Cache holds the prepended older candles merged with the primed pair,
    // strictly ascending with the overlapping bar (1_700_000_000_000) deduped
    // rather than doubled — getHistory feeds setData, which requires it.
    const cached = reader.getHistory('BTC-PERP', '1h')
    expect(cached.isOk() && cached.value.map((c) => c.openTime)).toEqual([
      1_699_996_400_000,
      1_700_000_000_000,
      1_700_003_600_000,
    ])
  })

  it('STAB-02: re-fetching an already-cached older window keeps getHistory strictly ascending', async () => {
    // Reproduces the chart crash "data must be asc ordered by time". When a
    // pan-back loadOlder callback is cancelled (chart effect torn down while
    // the fetch is in flight) the reader cache advances but the chart's
    // historyRef does not — so the next pan-back fires loadOlder with the SAME
    // beforeOpenTime and the gateway returns the SAME older page. A blind
    // prepend then doubles that page in the cache, producing a backward jump.
    const beforeOpenTime = 1_700_000_000_000 // == cache[0] after backfill
    const olderPage: CandleSnapshotResponse = [
      { t: 1_699_992_800_000, T: 1_699_996_400_000, s: 'BTC', i: '1h', o: '48500', c: '49000', h: '49100', l: '48300', v: '4', n: 40 },
      { t: 1_699_996_400_000, T: 1_700_000_000_000, s: 'BTC', i: '1h', o: '49000', c: '49500', h: '49600', l: '48800', v: '5', n: 50 },
    ] as unknown as CandleSnapshotResponse
    const gateway = buildFakeGateway({
      getCandleSnapshot: (_coin, _interval, _start, end) => {
        if (end === undefined) return okAsync(buildHistory())
        return okAsync(olderPage)
      },
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }),
    })
    const reader = createHyperliquidCandlesReader({ gateway, logger: buildFakeLogger().logger })

    reader.subscribe('BTC-PERP', '1h', () => {})
    await new Promise((r) => setTimeout(r, 0))

    // Two pan-backs with the SAME beforeOpenTime fetch the SAME older page.
    await reader.loadOlder('BTC-PERP', '1h', beforeOpenTime, 500)
    await reader.loadOlder('BTC-PERP', '1h', beforeOpenTime, 500)

    const cached = reader.getHistory('BTC-PERP', '1h')
    expect(cached.isOk()).toBe(true)
    if (!cached.isOk()) return
    const times = cached.value.map((c) => c.openTime)
    const isStrictlyAscending = times.every((t, i) => i === 0 || times[i - 1] < t)
    expect(isStrictlyAscending).toBe(true)
  })

  it('loadOlder surfaces a CandleError after exhausting retries on transient network failures', async () => {
    const gateway = buildFakeGateway({
      getCandleSnapshot: () =>
        errAsync(new HyperliquidGatewayError('network', 'Hyperliquid HTTP error: 500')) as ResultAsync<CandleSnapshotResponse, HyperliquidGatewayError>,
      subscribeCandle: () =>
        okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        }) as ResultAsync<HyperliquidSubscription, HyperliquidGatewayError>,
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: fake.logger,
      setTimeout: (handler) => {
        Promise.resolve().then(handler)
        return 0
      },
    })

    const result = await reader.loadOlder('BTC-PERP', '1h', 1_700_000_000_000, 500)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.kind).toBe('load-older-failed')
    expect(fake.records.some((r) => r.message === 'loadOlder failed')).toBe(true)
  })

  it('Bug A: subscribe("") returns a no-op and never calls the gateway', () => {
    let snapshotCalls = 0
    let subscribeCalls = 0
    const gateway = buildFakeGateway({
      getCandleSnapshot: () => {
        snapshotCalls += 1
        return okAsync(buildHistory())
      },
      subscribeCandle: () => {
        subscribeCalls += 1
        return okAsync({
          unsubscribe: () => Promise.resolve(),
          failureSignal: new AbortController().signal,
        })
      },
    })
    const fake = buildFakeLogger()
    const reader = createHyperliquidCandlesReader({
      gateway,
      logger: fake.logger,
    })
    const unsub = reader.subscribe('', '1m', () => {})
    expect(typeof unsub).toBe('function')
    expect(snapshotCalls).toBe(0)
    expect(subscribeCalls).toBe(0)
    expect(
      fake.records.some(
        (r) =>
          r.level === 'warn' &&
          r.message === 'subscribe skipped: unresolved symbol' &&
          r.fields.channel === 'candle',
      ),
    ).toBe(true)
    unsub()
  })
})
