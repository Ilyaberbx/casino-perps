import { describe, it, expect } from 'vitest'
import type { Order } from '@/modules/shared/domain'
import { createHyperliquidOpenOrdersSnapshotReader } from '../open-orders-snapshot-reader'
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

function buildWith(openOrders: WebData2Response['openOrders']): WebData2Response {
  const base = buildWebData2()
  return { ...base, openOrders } as WebData2Response
}

const SAMPLE_ORDER = {
  coin: 'ETH',
  side: 'B' as const,
  limitPx: '1500',
  sz: '0.5',
  oid: 12345,
  timestamp: 1_700_000_000_000,
  origSz: '1.0',
  triggerCondition: 'N/A',
  isTrigger: false,
  triggerPx: '0',
  children: [],
  isPositionTpsl: false,
  reduceOnly: false,
  orderType: 'Limit' as const,
  tif: 'Gtc' as const,
  cloid: null,
}

describe('createHyperliquidOpenOrdersSnapshotReader', () => {
  it('projects openOrders rows to domain Order shape', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    fake.emit(buildWith([SAMPLE_ORDER, { ...SAMPLE_ORDER, oid: 67, side: 'A', coin: 'BTC' }]))
    const orders = seen[seen.length - 1]
    expect(orders).toHaveLength(2)
    const eth = orders.find((o) => o.symbol === 'ETH')
    const btc = orders.find((o) => o.symbol === 'BTC')
    expect(eth?.identifier).toBe('12345')
    expect(eth?.side).toBe('buy')
    expect(eth?.price).toBeCloseTo(1500, 4)
    expect(eth?.size).toBeCloseTo(1.0, 4)
    expect(eth?.filledSize).toBeCloseTo(0.5, 4)
    expect(eth?.status).toBe('open')
    expect(eth?.orderType).toBe('limit')
    expect(eth?.timestamp).toBe(1_700_000_000_000)
    expect(btc?.side).toBe('sell')
    // ADR-0023 parity fields.
    expect(eth?.originalSize).toBeCloseTo(1.0, 4)
    expect(eth?.reduceOnly).toBe(false)
    expect(eth?.triggerConditions).toBeUndefined()
  })

  it('projects ADR-0051 trigger fields: triggerPrice, isPositionTpsl, triggerKind from orderType', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    fake.emit(
      buildWith([
        {
          ...SAMPLE_ORDER,
          oid: 101,
          coin: 'ETH',
          isTrigger: true,
          isPositionTpsl: true,
          triggerPx: '1700.5',
          orderType: 'Take Profit Market',
        },
        {
          ...SAMPLE_ORDER,
          oid: 102,
          coin: 'BTC',
          isTrigger: true,
          isPositionTpsl: true,
          triggerPx: '55000',
          orderType: 'Stop Market',
        },
        {
          ...SAMPLE_ORDER,
          oid: 103,
          coin: 'SOL',
          isTrigger: true,
          isPositionTpsl: true,
          triggerPx: '120',
          orderType: 'Stop Limit',
        },
      ]),
    )
    const orders = seen[seen.length - 1]
    const tp = orders.find((o) => o.symbol === 'ETH')
    const slMarket = orders.find((o) => o.symbol === 'BTC')
    const slLimit = orders.find((o) => o.symbol === 'SOL')

    expect(tp?.triggerPrice).toBeCloseTo(1700.5, 4)
    expect(tp?.isPositionTpsl).toBe(true)
    expect(tp?.triggerKind).toBe('tp')

    expect(slMarket?.triggerPrice).toBeCloseTo(55_000, 4)
    expect(slMarket?.triggerKind).toBe('sl')

    expect(slLimit?.triggerKind).toBe('sl')
  })

  it('leaves triggerPrice / isPositionTpsl / triggerKind absent on a plain limit order', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    // SAMPLE_ORDER carries triggerPx '0', isPositionTpsl false, orderType 'Limit'.
    fake.emit(buildWith([SAMPLE_ORDER]))
    const order = seen[seen.length - 1][0]
    expect(order.triggerPrice).toBeUndefined()
    expect(order.isPositionTpsl).toBe(false)
    expect(order.triggerKind).toBeUndefined()
  })

  it('maps trigger orders: isTrigger ⇒ triggerConditions carries the SDK condition', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    fake.emit(
      buildWith([
        { ...SAMPLE_ORDER, oid: 88, isTrigger: true, triggerCondition: 'Price above 1600', reduceOnly: true },
      ]),
    )
    const order = seen[seen.length - 1][0]
    expect(order.triggerConditions).toBe('Price above 1600')
    expect(order.reduceOnly).toBe(true)
  })

  it('returns empty list when openOrders is empty', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    fake.emit(buildWith([]))
    expect(seen[seen.length - 1]).toHaveLength(0)
  })

  it('re-emits on each upstream tick', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const counts: number[] = []
    reader.subscribe((o) => counts.push(o.length))
    fake.emit(buildWith([SAMPLE_ORDER]))
    fake.emit(buildWith([SAMPLE_ORDER, { ...SAMPLE_ORDER, oid: 2 }]))
    expect(counts).toEqual([1, 2])
  })

  it('unsubscribing stops further callbacks', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: number[] = []
    const unsub = reader.subscribe((o) => seen.push(o.length))
    fake.emit(buildWith([SAMPLE_ORDER]))
    const before = seen.length
    unsub()
    fake.emit(buildWith([SAMPLE_ORDER, { ...SAMPLE_ORDER, oid: 9 }]))
    expect(seen.length).toBe(before)
  })

  it('emits a debug projection record per update with module + count', () => {
    const fake = fakeStream()
    const fakeLogger = buildFakeLogger()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      fakeLogger.logger,
    )
    reader.subscribe(() => {})
    fake.emit(buildWith([SAMPLE_ORDER]))
    const projections = fakeLogger.records.filter(
      (r) => r.level === 'debug' && r.message === 'projection',
    )
    expect(projections.length).toBeGreaterThanOrEqual(1)
    expect(projections[0].fields.module).toBe(
      'hyperliquid-open-orders-snapshot-reader',
    )
    expect(projections[0].fields).toHaveProperty('count', 1)
  })

  it('dedupes orders that share an oid so they cannot collide as React keys', () => {
    const fake = fakeStream()
    const reader = createHyperliquidOpenOrdersSnapshotReader(
      fake.stream,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<Order>> = []
    reader.subscribe((o) => seen.push(o))
    fake.emit(
      buildWith([SAMPLE_ORDER, { ...SAMPLE_ORDER, coin: 'BTC', side: 'A' }]),
    )
    const orders = seen[seen.length - 1]
    expect(orders.map((o) => o.identifier)).toEqual(['12345'])
  })
})
