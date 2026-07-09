import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type { Fill, WalletAddress } from '@/modules/shared/domain'
import { createHyperliquidTradeHistoryReader } from '../trade-history-reader'
import type { UserFillsByTimeResponse } from '../../gateway/sdk-types'
import type { HyperliquidTimeWindow } from '../../gateway/hyperliquid-gateway.types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const NOW = 1_700_000_000_000

function fakeFill(
  partial: Partial<{
    tid: number
    oid: number
    coin: string
    side: 'B' | 'A'
    px: string
    sz: string
    fee: string
    time: number
  }> = {},
): UserFillsByTimeResponse[number] {
  return {
    coin: partial.coin ?? 'ETH',
    px: partial.px ?? '2500',
    sz: partial.sz ?? '1.5',
    side: partial.side ?? 'B',
    time: partial.time ?? NOW - 1_000,
    startPosition: '0',
    dir: 'Open Long',
    closedPnl: '0',
    hash: '0x' + '0'.repeat(64),
    oid: partial.oid ?? 1,
    crossed: true,
    fee: partial.fee ?? '0.5',
    tid: partial.tid ?? 1,
    feeToken: 'USDC',
    twapId: null,
  } as unknown as UserFillsByTimeResponse[number]
}

describe('createHyperliquidTradeHistoryReader', () => {
  it('subscribe emits accumulated list synchronously and never fetches', () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserFillsByTime: () => {
        calls += 1
        return okAsync([])
      },
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    expect(calls).toBe(0)
    expect(seen).toEqual([[]])
  })

  it('first loadOlder fetches the full window from epoch and projects parity fields', async () => {
    const calls: HyperliquidTimeWindow[] = []
    const gateway = buildFakeGateway({
      getUserFillsByTime: (_addr, window) => {
        calls.push(window)
        return okAsync([fakeFill({ tid: 7, oid: 9, coin: 'ETH' })])
      },
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))

    const original = Date.now
    Date.now = () => NOW
    try {
      const result = await reader.loadOlder()
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    } finally {
      Date.now = original
    }
    // Descending mode pages by an endTime cursor, starting at `now`.
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ startTime: 0, endTime: NOW })

    const final = seen[seen.length - 1]
    expect(final).toHaveLength(1)
    expect(final?.[0]?.identifier).toBe('7')
    expect(final?.[0]?.orderIdentifier).toBe('9')
    expect(final?.[0]?.symbol).toBe('ETH')
    expect(final?.[0]?.side).toBe('buy')
    expect(final?.[0]?.size).toBeCloseTo(1.5, 4)
    expect(final?.[0]?.price).toBeCloseTo(2500, 4)
    expect(final?.[0]?.fee).toBeCloseTo(0.5, 4)
    expect(final?.[0]?.closedPnl).toBeCloseTo(0, 4)
    expect(final?.[0]?.direction).toBe('Open Long')
    expect(final?.[0]?.crossed).toBe(true)
    expect(final?.[0]?.feeToken).toBe('USDC')
  })

  it('projects crossed:false and a non-USDC feeToken verbatim', async () => {
    const gateway = buildFakeGateway({
      getUserFillsByTime: () =>
        okAsync([
          {
            ...fakeFill({ tid: 11 }),
            crossed: false,
            feeToken: 'HYPE',
          } as unknown as UserFillsByTimeResponse[number],
        ]),
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    const fill = seen[seen.length - 1]?.[0]
    expect(fill?.crossed).toBe(false)
    expect(fill?.feeToken).toBe('HYPE')
  })

  it('leaves crossed/feeToken undefined when the payload omits them', async () => {
    const gateway = buildFakeGateway({
      getUserFillsByTime: () => {
        // A venue/page that omits the taker flag and fee token entirely — the
        // projection must NOT invent values (absent ⇒ render '--' / 'USDC').
        const bare = fakeFill({ tid: 13 }) as Record<string, unknown>
        delete bare.crossed
        delete bare.feeToken
        return okAsync([bare as unknown as UserFillsByTimeResponse[number]])
      },
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    const fill = seen[seen.length - 1]?.[0]
    expect(fill?.crossed).toBeUndefined()
    expect(fill?.feeToken).toBeUndefined()
  })

  it('emits fills NEWEST-FIRST', async () => {
    const gateway = buildFakeGateway({
      getUserFillsByTime: () =>
        okAsync([
          fakeFill({ tid: 1, time: NOW - 1_000 }),
          fakeFill({ tid: 2, time: NOW - 3_000 }),
          fakeFill({ tid: 3, time: NOW - 2_000 }),
        ]),
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((f) => f.identifier)).toEqual(['1', '3', '2'])
  })

  it('dedupes fills within a page that share a tid (two-sided self-trade)', async () => {
    const gateway = buildFakeGateway({
      getUserFillsByTime: () =>
        okAsync([fakeFill({ tid: 7, side: 'B' }), fakeFill({ tid: 7, side: 'A' }), fakeFill({ tid: 8 })]),
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((f) => f.identifier).sort()).toEqual(['7', '8'])
  })

  it('returns ok({ exhausted: true }) without calling gateway when address is null', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserFillsByTime: () => {
        calls += 1
        return okAsync([fakeFill()])
      },
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => null, buildFakeLogger().logger)
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('clears entries when getAddress() goes from a wallet to null', async () => {
    let current: WalletAddress | null = ADDRESS
    const gateway = buildFakeGateway({
      getUserFillsByTime: () => okAsync([fakeFill({ tid: 99 })]),
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => current, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<Fill>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
      expect(seen[seen.length - 1]).toHaveLength(1)
      current = null
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      expect(seen[seen.length - 1]).toEqual([])
    } finally {
      Date.now = original
    }
  })

  it('gateway error surfaces via mapped PortfolioHistoryFetchError; subsequent call retries', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserFillsByTime: () => {
        calls += 1
        if (calls === 1) return errAsync(new HyperliquidGatewayError('rate-limited', 'slow'))
        return okAsync([fakeFill({ tid: 5 })])
      },
    })
    const reader = createHyperliquidTradeHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    reader.subscribe(() => {})
    const r1 = await reader.loadOlder()
    expect(r1.isErr()).toBe(true)
    expect(r1._unsafeUnwrapErr()).toEqual({ kind: 'rate-limited' })
    const r2 = await reader.loadOlder()
    expect(r2.isOk()).toBe(true)
    expect(calls).toBe(2)
  })
})
