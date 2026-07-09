import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type {
  FundingHistoryEntry,
  WalletAddress,
} from '@/modules/shared/domain'
import {
  createHyperliquidFundingHistoryReader,
  mapGatewayError,
} from '../funding-history-reader'
import type { UserFundingResponse } from '../../gateway/sdk-types'
import {
  HyperliquidGatewayError,
  type HyperliquidTimeWindow,
} from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const ADDRESS_B = '0x1111111111111111111111111111111111111111' as WalletAddress
const NOW = 1_700_000_000_000

function makeRow(
  partial: Partial<{ coin: string; usdc: string; fundingRate: string; szi: string; time: number }> = {},
): UserFundingResponse[number] {
  return {
    delta: {
      type: 'funding',
      coin: partial.coin ?? 'ETH',
      usdc: partial.usdc ?? '-1.25',
      fundingRate: partial.fundingRate ?? '0.0000417',
      szi: partial.szi ?? '49.1477',
      nSamples: null,
    },
    hash: '0xdeadbeef',
    time: partial.time ?? NOW,
  } as unknown as UserFundingResponse[number]
}

describe('createHyperliquidFundingHistoryReader', () => {
  it('subscribers start with empty entries', () => {
    const reader = createHyperliquidFundingHistoryReader(buildFakeGateway(), () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<FundingHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    expect(seen).toEqual([[]])
  })

  it('loadOlder fetches the full window from epoch, projects rows, and exhausts on a short page', async () => {
    const calls: HyperliquidTimeWindow[] = []
    const reader = createHyperliquidFundingHistoryReader(
      buildFakeGateway({
        getUserFunding: (_addr, window) => {
          calls.push(window)
          return okAsync([makeRow({ coin: 'ETH', usdc: '-2.5', time: NOW })])
        },
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<FundingHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    } finally {
      Date.now = original
    }
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ startTime: 0, endTime: NOW })
    const final = seen[seen.length - 1]
    expect(final).toHaveLength(1)
    expect(final[0]?.symbol).toBe('ETH')
    expect(final[0]?.amountUsd).toBeCloseTo(-2.5, 4)
    expect(final[0]?.fundingRate).toBeCloseTo(0.0000417, 9)
    expect(final[0]?.positionSize).toBeCloseTo(49.1477, 4)
    expect(final[0]?.timestamp).toBe(NOW)
  })

  it('emits entries NEWEST-FIRST', async () => {
    const reader = createHyperliquidFundingHistoryReader(
      buildFakeGateway({
        getUserFunding: () =>
          okAsync([
            makeRow({ coin: 'A', time: NOW - 3_000 }),
            makeRow({ coin: 'B', time: NOW - 1_000 }),
            makeRow({ coin: 'C', time: NOW - 2_000 }),
          ]),
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<FundingHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((e) => e.symbol)).toEqual(['B', 'C', 'A'])
  })

  it('returns ok({exhausted:true}) when address is null without calling gateway', async () => {
    let calls = 0
    const reader = createHyperliquidFundingHistoryReader(
      buildFakeGateway({
        getUserFunding: () => {
          calls += 1
          return okAsync([makeRow()])
        },
      }),
      () => null,
      buildFakeLogger().logger,
    )
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('resets and refetches from epoch on address change', async () => {
    const calls: Array<{ addr: WalletAddress; window: HyperliquidTimeWindow }> = []
    let current: WalletAddress | null = ADDRESS
    const reader = createHyperliquidFundingHistoryReader(
      buildFakeGateway({
        getUserFunding: (addr, window) => {
          calls.push({ addr, window })
          return okAsync([makeRow({ coin: addr === ADDRESS ? 'ETH' : 'BTC', time: NOW })])
        },
      }),
      () => current,
      buildFakeLogger().logger,
    )
    const seen: Array<ReadonlyArray<FundingHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
      current = ADDRESS_B
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(calls[1]?.addr).toBe(ADDRESS_B)
    expect(calls[1]?.window).toEqual({ startTime: 0, endTime: NOW })
    expect(seen[seen.length - 1]?.map((e) => e.symbol)).toEqual(['BTC'])
  })

  it('maps gateway error to PortfolioHistoryFetchError', async () => {
    const reader = createHyperliquidFundingHistoryReader(
      buildFakeGateway({
        getUserFunding: () => errAsync(new HyperliquidGatewayError('rate-limited', 'slow down')),
      }),
      () => ADDRESS,
      buildFakeLogger().logger,
    )
    const result = await reader.loadOlder()
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error).toEqual({ kind: 'rate-limited' })
  })
})

describe('mapGatewayError', () => {
  it("maps 'network' to { kind: 'network' }", () => {
    expect(mapGatewayError(new HyperliquidGatewayError('network', 'x'))).toEqual({ kind: 'network' })
  })
  it("maps 'rate-limited' to { kind: 'rate-limited' }", () => {
    expect(mapGatewayError(new HyperliquidGatewayError('rate-limited', 'x'))).toEqual({ kind: 'rate-limited' })
  })
  it("maps 'invalid-response' to { kind: 'unknown' }", () => {
    const out = mapGatewayError(new HyperliquidGatewayError('invalid-response', 'malformed'))
    expect(out.kind).toBe('unknown')
    if (out.kind === 'unknown') expect(out.message).toBe('malformed')
  })
  it("maps 'unknown-address' to { kind: 'unknown' }", () => {
    const out = mapGatewayError(new HyperliquidGatewayError('unknown-address', 'no addr'))
    expect(out.kind).toBe('unknown')
  })
})
