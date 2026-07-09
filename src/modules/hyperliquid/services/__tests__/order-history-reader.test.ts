import { describe, it, expect } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type {
  HistoricalOrder,
  WalletAddress,
} from '@/modules/shared/domain'
import {
  createHyperliquidOrderHistoryReader,
  projectHistoricalOrders,
  collapseToLatestStatus,
} from '../order-history-reader'
import type { HistoricalOrdersResponse } from '../../gateway/sdk-types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

const SAMPLE_ORDER = {
  coin: 'ETH',
  side: 'B' as const,
  limitPx: '2500.50',
  sz: '1.5',
  oid: 12345,
  timestamp: 1_700_000_000_000,
  origSz: '2.0',
  triggerCondition: 'N/A',
  isTrigger: false,
  triggerPx: '0',
  children: [] as unknown[],
  isPositionTpsl: false,
  reduceOnly: false,
  orderType: 'Limit' as const,
  tif: 'Gtc' as const,
  cloid: null,
}

const SAMPLE_RESPONSE: HistoricalOrdersResponse = [
  {
    order: SAMPLE_ORDER,
    status: 'filled',
    statusTimestamp: 1_700_000_100_000,
  },
  {
    order: { ...SAMPLE_ORDER, coin: 'BTC', side: 'A', oid: 67890 },
    status: 'canceled',
    statusTimestamp: 1_700_000_200_000,
  },
  {
    order: { ...SAMPLE_ORDER, coin: 'SOL', oid: 99999 },
    status: 'rejected',
    statusTimestamp: 1_700_000_300_000,
  },
]

describe('createHyperliquidOrderHistoryReader', () => {
  it('subscribes start with empty orders', () => {
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway(),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))
    expect(seen).toEqual([[]])
  })

  it('first loadOlder fetches, projects, notifies, and resolves exhausted:true', async () => {
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => okAsync(SAMPLE_RESPONSE),
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))
    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })

    const final = seen[seen.length - 1]
    expect(final).toHaveLength(3)
    const eth = final.find((o) => o.symbol === 'ETH')!
    expect(eth.identifier).toBe('12345')
    expect(eth.side).toBe('buy')
    expect(eth.price).toBeCloseTo(2500.5, 4)
    expect(eth.size).toBeCloseTo(1.5, 4)
    expect(eth.originalSize).toBeCloseTo(2.0, 4)
    expect(eth.orderType).toBe('Limit')
    expect(eth.timeInForce).toBe('Gtc')
    expect(eth.status).toBe('filled')
    expect(eth.createdAt).toBe(1_700_000_000_000)
    expect(eth.statusTimestamp).toBe(1_700_000_100_000)

    const btc = final.find((o) => o.symbol === 'BTC')!
    expect(btc.side).toBe('sell')
    expect(btc.status).toBe('canceled')

    const sol = final.find((o) => o.symbol === 'SOL')!
    expect(sol.status).toBe('rejected')
  })

  it('issues exactly one underlying gateway call regardless of how many loadOlder calls are made', async () => {
    let calls = 0
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => {
          calls += 1
          return okAsync(SAMPLE_RESPONSE)
        },
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    reader.subscribe(() => {})
    const r1 = await reader.loadOlder()
    const r2 = await reader.loadOlder()
    const r3 = await reader.loadOlder()
    expect(calls).toBe(1)
    expect(r1.isOk()).toBe(true)
    expect(r2._unsafeUnwrap()).toEqual({ exhausted: true })
    expect(r3._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('subsequent loadOlder calls after an erroring first call are no-ops returning ok({exhausted:true})', async () => {
    let calls = 0
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => {
          calls += 1
          return errAsync(new HyperliquidGatewayError('network', 'down'))
        },
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const r1 = await reader.loadOlder()
    const r2 = await reader.loadOlder()
    expect(calls).toBe(1)
    expect(r1.isErr()).toBe(true)
    expect(r2.isOk()).toBe(true)
    expect(r2._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('returns ok({exhausted:true}) without calling gateway when address is null', async () => {
    let calls = 0
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => {
          calls += 1
          return okAsync(SAMPLE_RESPONSE)
        },
      }),
      () => null,
      buildFakeLogger().logger,
    )
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result.isOk()).toBe(true)
  })

  it('re-fetches and re-emits B-only orders when getAddress() changes from A to B', async () => {
    const ADDRESS_B = '0x1111111111111111111111111111111111111111' as WalletAddress
    const responseFor: Record<string, HistoricalOrdersResponse> = {
      [ADDRESS]: [
        { order: { ...SAMPLE_ORDER, coin: 'ETH', oid: 1 }, status: 'filled', statusTimestamp: 1 },
      ],
      [ADDRESS_B]: [
        { order: { ...SAMPLE_ORDER, coin: 'BTC', oid: 2 }, status: 'filled', statusTimestamp: 2 },
      ],
    }
    const calledWith: WalletAddress[] = []
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: (addr) => {
          calledWith.push(addr)
          return okAsync(responseFor[addr] ?? [])
        },
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))

    await reader.loadOlder()
    expect(seen[seen.length - 1]?.map((o) => o.symbol)).toEqual(['ETH'])

    current = ADDRESS_B
    await reader.loadOlder()
    expect(calledWith).toEqual([ADDRESS, ADDRESS_B])
    expect(seen[seen.length - 1]?.map((o) => o.symbol)).toEqual(['BTC'])
  })

  it('clears orders when getAddress() goes from a wallet to null', async () => {
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => okAsync(SAMPLE_RESPONSE),
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))
    await reader.loadOlder()
    expect(seen[seen.length - 1]).toHaveLength(3)
    current = null
    await reader.loadOlder()
    expect(seen[seen.length - 1]).toEqual([])
  })

  it('discards stale projection when getAddress() rotates mid-flight', async () => {
    const ADDRESS_B = '0x2222222222222222222222222222222222222222' as WalletAddress
    let resolveA: (response: HistoricalOrdersResponse) => void = () => {}
    const aPromise = new Promise<HistoricalOrdersResponse>((resolve) => {
      resolveA = resolve
    })
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({
        getHistoricalOrders: () => ResultAsync.fromSafePromise(aPromise),
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))

    const inFlight = reader.loadOlder()
    current = ADDRESS_B
    resolveA(SAMPLE_RESPONSE)
    await inFlight
    expect(seen).toEqual([[]])
  })

  it('collapses orders sharing an oid to one row carrying the latest status', async () => {
    const response: HistoricalOrdersResponse = [
      { order: SAMPLE_ORDER, status: 'open', statusTimestamp: 1 },
      { order: SAMPLE_ORDER, status: 'filled', statusTimestamp: 2 },
      { order: { ...SAMPLE_ORDER, oid: 67890 }, status: 'canceled', statusTimestamp: 3 },
    ]
    const reader = createHyperliquidOrderHistoryReader(
      buildFakeGateway({ getHistoricalOrders: () => okAsync(response) }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<HistoricalOrder>> = []
    reader.subscribe((next) => seen.push(next))
    await reader.loadOlder()
    const final = seen[seen.length - 1] ?? []
    expect(final.map((o) => o.identifier)).toEqual(['12345', '67890'])
    // The newer status (filled @ ts 2) wins over the earlier 'open' @ ts 1.
    expect(final.find((o) => o.identifier === '12345')?.status).toBe('filled')
  })

  it('maps gateway errors via the canonical history error helper', async () => {
    for (const [kind, expected] of [
      ['network', 'network'],
      ['rate-limited', 'rate-limited'],
      ['invalid-response', 'unknown'],
      ['unknown-address', 'unknown'],
    ] as const) {
      const reader = createHyperliquidOrderHistoryReader(
        buildFakeGateway({
          getHistoricalOrders: () =>
            errAsync(new HyperliquidGatewayError(kind, 'boom')),
        }),
        () => ADDRESS,
        buildFakeLogger().logger,
      )
      const result = await reader.loadOlder()
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.kind).toBe(expected)
      }
    }
  })
})

describe('projectHistoricalOrders', () => {
  it('preserves SDK status literals as-is on the domain entity', () => {
    const out = projectHistoricalOrders([
      {
        order: SAMPLE_ORDER,
        status: 'openInterestCapCanceled',
        statusTimestamp: 1,
      },
    ])
    expect(out[0].status).toBe('openInterestCapCanceled')
  })
})

describe('collapseToLatestStatus', () => {
  it('keeps the record with the greatest statusTimestamp per oid, regardless of input order', () => {
    const newest = projectHistoricalOrders([{ order: SAMPLE_ORDER, status: 'filled', statusTimestamp: 9 }])
    const older = projectHistoricalOrders([{ order: SAMPLE_ORDER, status: 'open', statusTimestamp: 1 }])
    // Newest listed first, older second — keep-latest must beat keep-first.
    const out = collapseToLatestStatus([...newest, ...older])
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('filled')
  })

  it('preserves the first-seen position of each distinct oid', () => {
    const a = projectHistoricalOrders([{ order: { ...SAMPLE_ORDER, oid: 1 }, status: 'open', statusTimestamp: 1 }])
    const b = projectHistoricalOrders([{ order: { ...SAMPLE_ORDER, oid: 2 }, status: 'open', statusTimestamp: 1 }])
    const aLater = projectHistoricalOrders([{ order: { ...SAMPLE_ORDER, oid: 1 }, status: 'filled', statusTimestamp: 5 }])
    const out = collapseToLatestStatus([...a, ...b, ...aLater])
    expect(out.map((o) => o.identifier)).toEqual(['1', '2'])
    expect(out[0].status).toBe('filled')
  })

  it('passes an already-unique list through unchanged', () => {
    const orders = projectHistoricalOrders(SAMPLE_RESPONSE)
    expect(collapseToLatestStatus(orders)).toEqual(orders)
  })
})
