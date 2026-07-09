import { describe, it, expect } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type {
  TwapHistoryEntry,
  WalletAddress,
} from '@/modules/shared/domain'
import {
  createHyperliquidTwapHistoryReader,
  mapGatewayError,
} from '../twap-history-reader'
import type { TwapHistoryResponse } from '../../gateway/sdk-types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress

const SAMPLE_STATE = {
  coin: 'ETH',
  executedNtl: '12500.5',
  executedSz: '5.0',
  minutes: 60,
  randomize: false,
  reduceOnly: false,
  side: 'B' as const,
  sz: '10.0',
  timestamp: 1_700_000_000_000,
  user: ADDRESS as unknown as `0x${string}`,
}

const SAMPLE_RESPONSE: TwapHistoryResponse = [
  {
    time: 1_700_000_300, // seconds since epoch
    state: SAMPLE_STATE,
    status: { status: 'finished' },
    twapId: 4242,
  },
  {
    time: 1_700_000_400,
    state: { ...SAMPLE_STATE, coin: 'BTC', side: 'A' },
    status: { status: 'activated' },
  },
  {
    time: 1_700_000_500,
    state: { ...SAMPLE_STATE, coin: 'SOL' },
    status: { status: 'error', description: 'oops' },
    twapId: 9000,
  },
]

describe('createHyperliquidTwapHistoryReader', () => {
  it('subscribes start with empty entries', () => {
    const gateway = buildFakeGateway()
    const reader = createHyperliquidTwapHistoryReader(
      gateway,
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<TwapHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    expect(seen).toHaveLength(1)
    expect(seen[0]).toEqual([])
  })

  it('first loadOlder fetches, projects to entries, notifies subscribers, and resolves exhausted:true', async () => {
    const gateway = buildFakeGateway({
      getTwapHistory: () => okAsync(SAMPLE_RESPONSE),
    })
    const reader = createHyperliquidTwapHistoryReader(
      gateway,
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<TwapHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })

    // last emission is the projected list
    const final = seen[seen.length - 1]
    expect(final).toHaveLength(3)
    const eth = final.find((e) => e.symbol === 'ETH')
    const btc = final.find((e) => e.symbol === 'BTC')
    const sol = final.find((e) => e.symbol === 'SOL')

    expect(eth?.identifier).toBe('4242')
    expect(eth?.side).toBe('buy')
    expect(eth?.size).toBeCloseTo(10, 4)
    expect(eth?.executedSize).toBeCloseTo(5, 4)
    expect(eth?.executedNotionalUsd).toBeCloseTo(12500.5, 4)
    expect(eth?.status).toBe('finished')
    expect(eth?.createdAt).toBe(1_700_000_000_000)
    expect(eth?.endedAt).toBe(1_700_000_300_000)

    expect(btc?.side).toBe('sell')
    expect(btc?.status).toBe('activated')
    expect(btc?.endedAt).toBe(null)
    // synthetic identifier (no twapId)
    expect(btc?.identifier).toContain('BTC')

    expect(sol?.identifier).toBe('9000')
    expect(sol?.status).toBe('error')
  })

  it('issues exactly one underlying gateway call regardless of how many loadOlder calls are made', async () => {
    let calls = 0
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => {
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
    expect(r2.isOk()).toBe(true)
    expect(r3.isOk()).toBe(true)
    expect(r2._unsafeUnwrap()).toEqual({ exhausted: true })
    expect(r3._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('subsequent loadOlder calls after an erroring first call are no-ops returning ok({exhausted:true})', async () => {
    let calls = 0
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => {
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
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => {
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
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('re-fetches and re-emits B-only entries when getAddress() changes from A to B', async () => {
    const ADDRESS_B =
      '0x1111111111111111111111111111111111111111' as WalletAddress
    const responseFor: Record<string, TwapHistoryResponse> = {
      [ADDRESS]: [
        {
          time: 1_700_000_300,
          state: { ...SAMPLE_STATE, coin: 'ETH' },
          status: { status: 'finished' },
          twapId: 1,
        },
      ],
      [ADDRESS_B]: [
        {
          time: 1_700_000_400,
          state: { ...SAMPLE_STATE, coin: 'BTC' },
          status: { status: 'finished' },
          twapId: 2,
        },
      ],
    }
    const calledWith: WalletAddress[] = []
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: (addr) => {
          calledWith.push(addr)
          return okAsync(responseFor[addr] ?? [])
        },
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<TwapHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))

    await reader.loadOlder()
    expect(calledWith).toEqual([ADDRESS])
    expect(seen[seen.length - 1]?.map((e) => e.symbol)).toEqual(['ETH'])

    current = ADDRESS_B
    await reader.loadOlder()
    expect(calledWith).toEqual([ADDRESS, ADDRESS_B])
    const final = seen[seen.length - 1]
    expect(final?.map((e) => e.symbol)).toEqual(['BTC'])
    expect(final?.find((e) => e.symbol === 'ETH')).toBeUndefined()
  })

  it('clears entries when getAddress() goes from a wallet to null', async () => {
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => okAsync(SAMPLE_RESPONSE),
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<TwapHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    await reader.loadOlder()
    expect(seen[seen.length - 1]).toHaveLength(3)

    current = null
    const result = await reader.loadOlder()
    expect(result.isOk()).toBe(true)
    expect(seen[seen.length - 1]).toEqual([])
  })

  it('discards stale projection when getAddress() rotates mid-flight without a follow-up loadOlder', async () => {
    const ADDRESS_B =
      '0x2222222222222222222222222222222222222222' as WalletAddress
    let resolveA: (response: TwapHistoryResponse) => void = () => {}
    const aPromise = new Promise<TwapHistoryResponse>((resolve) => {
      resolveA = resolve
    })
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => ResultAsync.fromSafePromise(aPromise),
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<TwapHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))

    const inFlight = reader.loadOlder()
    // Mutate the address before A's promise resolves; no second loadOlder runs.
    current = ADDRESS_B
    resolveA(SAMPLE_RESPONSE)
    const result = await inFlight
    expect(result.isOk()).toBe(true)
    // Stale A rows must NOT be projected — the only emission is the
    // initial subscribe() empty-list push.
    expect(seen).toEqual([[]])
  })

  it('does not mark fetched when first call sees a null address; fetches once an address appears', async () => {
    let calls = 0
    let current: WalletAddress | null = null
    const reader = createHyperliquidTwapHistoryReader(
      buildFakeGateway({
        getTwapHistory: () => {
          calls += 1
          return okAsync(SAMPLE_RESPONSE)
        },
      }),
      () => current,
      buildFakeLogger().logger,
    )
    await reader.loadOlder()
    expect(calls).toBe(0)
    current = ADDRESS
    await reader.loadOlder()
    expect(calls).toBe(1)
  })
})

describe('mapGatewayError', () => {
  it("maps 'network' to { kind: 'network' }", () => {
    expect(mapGatewayError(new HyperliquidGatewayError('network', 'x'))).toEqual({
      kind: 'network',
    })
  })
  it("maps 'rate-limited' to { kind: 'rate-limited' }", () => {
    expect(
      mapGatewayError(new HyperliquidGatewayError('rate-limited', 'x')),
    ).toEqual({ kind: 'rate-limited' })
  })
  it("maps 'invalid-response' to { kind: 'unknown' }", () => {
    const out = mapGatewayError(
      new HyperliquidGatewayError('invalid-response', 'malformed'),
    )
    expect(out.kind).toBe('unknown')
    if (out.kind === 'unknown') expect(out.message).toBe('malformed')
  })
  it("maps 'unknown-address' to { kind: 'unknown' }", () => {
    const out = mapGatewayError(
      new HyperliquidGatewayError('unknown-address', 'no addr'),
    )
    expect(out.kind).toBe('unknown')
  })
})
