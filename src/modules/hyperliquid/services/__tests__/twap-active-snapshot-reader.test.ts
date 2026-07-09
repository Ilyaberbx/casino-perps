import { describe, it, expect } from 'vitest'
import type { ActiveTwap } from '@/modules/shared/domain'
import { createHyperliquidTwapActiveSnapshotReader } from '../twap-active-snapshot-reader'
import type { WebData2Stream } from '../web-data2-stream'
import type { WebData2Response } from '../../gateway/sdk-types'
import { buildFakeLogger, buildWebData2 } from '../__fixtures__/web-data2'

function fakeStream(): {
  stream: WebData2Stream
  emit: (s: WebData2Response) => void
} {
  const listeners = new Set<(s: WebData2Response) => void>()
  let latest: WebData2Response | null = null
  return {
    stream: {
      current: () => latest,
      subscribe(onUpdate) {
        listeners.add(onUpdate)
        if (latest !== null) onUpdate(latest)
        return () => listeners.delete(onUpdate)
      },
      connectionStatus: {
        status: () => 'connected',
        subscribe: () => () => {},
      },
      refreshAddress: () => {},
      stop: () => {},
    },
    emit(s) {
      latest = s
      for (const l of listeners) l(s)
    },
  }
}

function buildWith(
  twapStates: WebData2Response['twapStates'],
): WebData2Response {
  const base = buildWebData2()
  return { ...base, twapStates } as WebData2Response
}

const SAMPLE_TWAP_STATE = {
  coin: 'ETH',
  executedNtl: '12500.5',
  executedSz: '5.0',
  minutes: 60,
  randomize: false,
  reduceOnly: false,
  side: 'B' as const,
  sz: '10.0',
  timestamp: 1_700_000_000_000,
  user: '0xabcdef0123456789abcdef0123456789abcdef01' as `0x${string}`,
}

describe('createHyperliquidTwapActiveSnapshotReader', () => {
  it('projects twapStates tuples to domain ActiveTwap shape', () => {
    const fake = fakeStream()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<ActiveTwap>> = []
    reader.subscribe((t) => seen.push(t))
    fake.emit(
      buildWith([
        [101, SAMPLE_TWAP_STATE],
        [202, { ...SAMPLE_TWAP_STATE, coin: 'BTC', side: 'A', reduceOnly: true, randomize: true }],
      ]),
    )
    const twaps = seen[seen.length - 1]
    expect(twaps).toHaveLength(2)
    const eth = twaps.find((t) => t.symbol === 'ETH')
    const btc = twaps.find((t) => t.symbol === 'BTC')
    expect(eth?.identifier).toBe('101')
    expect(eth?.side).toBe('buy')
    expect(eth?.size).toBeCloseTo(10.0, 4)
    expect(eth?.executedSize).toBeCloseTo(5.0, 4)
    expect(eth?.executedNotionalUsd).toBeCloseTo(12500.5, 4)
    expect(eth?.durationMinutes).toBe(60)
    expect(eth?.reduceOnly).toBe(false)
    expect(eth?.randomize).toBe(false)
    expect(eth?.createdAt).toBe(1_700_000_000_000)
    expect(btc?.identifier).toBe('202')
    expect(btc?.side).toBe('sell')
    expect(btc?.reduceOnly).toBe(true)
    expect(btc?.randomize).toBe(true)
  })

  it('returns empty list when twapStates is empty', () => {
    const fake = fakeStream()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<ActiveTwap>> = []
    reader.subscribe((t) => seen.push(t))
    fake.emit(buildWith([]))
    expect(seen[seen.length - 1]).toHaveLength(0)
  })

  it('re-emits on each upstream tick', () => {
    const fake = fakeStream()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const counts: number[] = []
    reader.subscribe((t) => counts.push(t.length))
    fake.emit(buildWith([[1, SAMPLE_TWAP_STATE]]))
    fake.emit(buildWith([[1, SAMPLE_TWAP_STATE], [2, SAMPLE_TWAP_STATE]]))
    expect(counts).toEqual([1, 2])
  })

  it('unsubscribing stops further callbacks', () => {
    const fake = fakeStream()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: number[] = []
    const unsub = reader.subscribe((t) => seen.push(t.length))
    fake.emit(buildWith([[1, SAMPLE_TWAP_STATE]]))
    const before = seen.length
    unsub()
    fake.emit(buildWith([[1, SAMPLE_TWAP_STATE], [2, SAMPLE_TWAP_STATE]]))
    expect(seen.length).toBe(before)
  })

  it('emits a debug projection record per update with module + count', () => {
    const fake = fakeStream()
    const fakeLogger = buildFakeLogger()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      fakeLogger.logger,
    )
    reader.subscribe(() => {})
    fake.emit(buildWith([[1, SAMPLE_TWAP_STATE]]))
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe(
      'hyperliquid-twap-active-snapshot-reader',
    )
    expect(projections[0].fields).toHaveProperty('count', 1)
  })

  it('dedupes twaps that share an id so they cannot collide as React keys', () => {
    const fake = fakeStream()
    const reader = createHyperliquidTwapActiveSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<ActiveTwap>> = []
    reader.subscribe((t) => seen.push(t))
    fake.emit(
      buildWith([
        [101, SAMPLE_TWAP_STATE],
        [101, { ...SAMPLE_TWAP_STATE, coin: 'BTC' }],
      ]),
    )
    const twaps = seen[seen.length - 1]
    expect(twaps.map((t) => t.identifier)).toEqual(['101'])
  })
})
