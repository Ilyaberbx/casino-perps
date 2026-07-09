import { describe, it, expect } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import type {
  AccountActivityEntry,
  WalletAddress,
} from '@/modules/shared/domain'
import { createHyperliquidAccountActivityReader } from '../account-activity-reader'
import type { UserNonFundingLedgerUpdatesResponse } from '../../gateway/sdk-types'
import type { HyperliquidTimeWindow } from '../../gateway/hyperliquid-gateway.types'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import { buildFakeGateway, buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const ADDRESS_B = '0x1111111111111111111111111111111111111111' as WalletAddress
const NOW = 1_700_000_000_000

function fakeRecord(
  partial: Partial<{
    time: number
    hash: `0x${string}`
    delta: UserNonFundingLedgerUpdatesResponse[number]['delta']
  }> = {},
): UserNonFundingLedgerUpdatesResponse[number] {
  return {
    time: partial.time ?? NOW - 1_000,
    hash: partial.hash ?? (('0x' + 'a'.repeat(64)) as `0x${string}`),
    delta: partial.delta ?? { type: 'deposit', usdc: '1500.00' },
  }
}

describe('createHyperliquidAccountActivityReader', () => {
  it('subscribe emits empty list synchronously and never fetches', () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: () => {
        calls += 1
        return okAsync([])
      },
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<AccountActivityEntry>> = []
    reader.subscribe((next) => seen.push(next))
    expect(calls).toBe(0)
    expect(seen).toEqual([[]])
  })

  it('loadOlder fetches the full window from epoch and projects rows preserving the SDK delta shape', async () => {
    const calls: HyperliquidTimeWindow[] = []
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: (_addr, window) => {
        calls.push(window)
        return okAsync([
          fakeRecord({ delta: { type: 'accountClassTransfer', usdc: '250.00', toPerp: true } }),
        ])
      },
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<AccountActivityEntry>> = []
    reader.subscribe((next) => seen.push(next))

    const original = Date.now
    Date.now = () => NOW
    try {
      const result = await reader.loadOlder()
      expect(result.isOk()).toBe(true)
      // A single short page means the full history is loaded ⇒ exhausted.
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    } finally {
      Date.now = original
    }
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ startTime: 0, endTime: NOW })

    const final = seen[seen.length - 1]
    expect(final).toHaveLength(1)
    const entry = final?.[0]
    expect(entry?.delta.type).toBe('accountClassTransfer')
    if (entry?.delta.type === 'accountClassTransfer') {
      expect(entry.delta.usdc).toBe('250.00')
      expect(entry.delta.toPerp).toBe(true)
    }
  })

  it('emits entries NEWEST-FIRST even though the ledger endpoint returns oldest-first', async () => {
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: () =>
        okAsync([
          fakeRecord({ time: NOW - 3_000, hash: ('0x' + '1'.repeat(64)) as `0x${string}` }),
          fakeRecord({ time: NOW - 1_000, hash: ('0x' + '2'.repeat(64)) as `0x${string}` }),
          fakeRecord({ time: NOW - 2_000, hash: ('0x' + '3'.repeat(64)) as `0x${string}` }),
        ]),
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<AccountActivityEntry>> = []
    reader.subscribe((next) => seen.push(next))
    const original = Date.now
    Date.now = () => NOW
    try {
      await reader.loadOlder()
    } finally {
      Date.now = original
    }
    expect(seen[seen.length - 1]?.map((e) => e.time)).toEqual([NOW - 1_000, NOW - 2_000, NOW - 3_000])
  })

  it('returns ok({ exhausted: true }) without calling gateway when address is null', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: () => {
        calls += 1
        return okAsync([fakeRecord()])
      },
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => null, buildFakeLogger().logger)
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  it('resets and refetches from epoch on address change', async () => {
    const calls: Array<{ addr: WalletAddress; window: HyperliquidTimeWindow }> = []
    let current: WalletAddress | null = ADDRESS
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: (addr, window) => {
        calls.push({ addr, window })
        return okAsync([fakeRecord({ delta: { type: 'deposit', usdc: addr === ADDRESS ? '1' : '2' } })])
      },
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => current, buildFakeLogger().logger)
    const seen: Array<ReadonlyArray<AccountActivityEntry>> = []
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
    const final = seen[seen.length - 1]
    expect(final).toHaveLength(1)
    if (final?.[0]?.delta.type === 'deposit') expect(final[0].delta.usdc).toBe('2')
  })

  it('gateway error surfaces as mapped PortfolioHistoryFetchError; subsequent call retries', async () => {
    let calls = 0
    const gateway = buildFakeGateway({
      getUserNonFundingLedgerUpdates: () => {
        calls += 1
        if (calls === 1) return errAsync(new HyperliquidGatewayError('rate-limited', 'slow'))
        return okAsync([fakeRecord()])
      },
    })
    const reader = createHyperliquidAccountActivityReader(gateway, () => ADDRESS, buildFakeLogger().logger)
    reader.subscribe(() => {})
    const r1 = await reader.loadOlder()
    expect(r1.isErr()).toBe(true)
    expect(r1._unsafeUnwrapErr()).toEqual({ kind: 'rate-limited' })
    const r2 = await reader.loadOlder()
    expect(r2.isOk()).toBe(true)
    expect(calls).toBe(2)
  })
})
