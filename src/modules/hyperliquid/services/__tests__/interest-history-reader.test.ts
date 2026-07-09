import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type {
  InterestHistoryEntry,
  WalletAddress,
} from '@/modules/shared/domain'
import { createHyperliquidInterestHistoryReader } from '../interest-history-reader'
import type { UserBorrowLendInterestResponse } from '../../gateway/sdk-types'
import type { HyperliquidTimeWindow } from '../../gateway/hyperliquid-gateway.types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const ADDRESS_B = '0x1111111111111111111111111111111111111111' as WalletAddress
const NOW = 1_700_000_000_000

function fakeEntry(
  partial: Partial<{ time: number; token: string; borrow: string; supply: string }> = {},
): UserBorrowLendInterestResponse[number] {
  return {
    time: partial.time ?? NOW - 1_000,
    token: partial.token ?? 'USDC',
    borrow: partial.borrow ?? '0',
    supply: partial.supply ?? '1.25',
  }
}

describe('createHyperliquidInterestHistoryReader', () => {
  it('subscribe emits accumulated list synchronously and never fetches', () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: () => {
        calls += 1
        return okAsync([])
      },
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<InterestHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    expect(calls).toBe(0)
    expect(seen).toEqual([[]])
  })

  it('loadOlder fetches the full window from epoch and projects net interest (supply − borrow)', async () => {
    const calls: HyperliquidTimeWindow[] = []
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: (_addr, window) => {
        calls.push(window)
        return okAsync([fakeEntry({ token: 'USDC', supply: '2.5', borrow: '0.5' })])
      },
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<InterestHistoryEntry>> = []
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
    expect(final?.[0]?.asset).toBe('USDC')
    expect(final?.[0]?.amountUsd).toBeCloseTo(2.0, 6)
    expect(final?.[0]?.timestamp).toBe(NOW - 1_000)
  })

  it('emits entries NEWEST-FIRST', async () => {
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: () =>
        okAsync([
          fakeEntry({ token: 'A', time: NOW - 3_000 }),
          fakeEntry({ token: 'B', time: NOW - 1_000 }),
          fakeEntry({ token: 'C', time: NOW - 2_000 }),
        ]),
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<InterestHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((e) => e.asset)).toEqual(['B', 'C', 'A'])
  })

  it('returns ok({ exhausted: true }) without calling gateway when address is null', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: () => {
        calls += 1
        return okAsync([fakeEntry()])
      },
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => null, buildFakeLogger().logger)
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('resets and refetches from epoch on address change', async () => {
    const calls: Array<{ addr: WalletAddress; window: HyperliquidTimeWindow }> = []
    let current: WalletAddress | null = ADDRESS
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: (addr, window) => {
        calls.push({ addr, window })
        return okAsync([fakeEntry({ token: addr === ADDRESS ? 'A' : 'B', supply: '1' })])
      },
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => current, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<InterestHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
      expect(seen[seen.length - 1]?.map((e) => e.asset)).toEqual(['A'])
      current = ADDRESS_B
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((e) => e.asset)).toEqual(['B'])
    expect(calls[1]?.addr).toBe(ADDRESS_B)
    expect(calls[1]?.window).toEqual({ startTime: 0, endTime: NOW })
  })

  it('clears entries when getAddress() goes from a wallet to null', async () => {
    let current: WalletAddress | null = ADDRESS
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: () => okAsync([fakeEntry()]),
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => current, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<InterestHistoryEntry>> = []
    reader.subscribe((next) => seen.push(next))
    await reader.loadOlder()
    expect(seen[seen.length - 1]).toHaveLength(1)
    current = null
    const result = await reader.loadOlder()
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    expect(seen[seen.length - 1]).toEqual([])
  })

  it('gateway error surfaces via mapped PortfolioHistoryFetchError; subsequent call retries', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserBorrowLendInterest: () => {
        calls += 1
        if (calls === 1) return errAsync(new HyperliquidGatewayError('rate-limited', 'slow'))
        return okAsync([fakeEntry({ token: 'OK' })])
      },
    })
    const reader = createHyperliquidInterestHistoryReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    reader.subscribe(() => {})
    const r1 = await reader.loadOlder()
    expect(r1.isErr()).toBe(true)
    expect(r1._unsafeUnwrapErr()).toEqual({ kind: 'rate-limited' })
    const r2 = await reader.loadOlder()
    expect(r2.isOk()).toBe(true)
    expect(calls).toBe(2)
  })
})
