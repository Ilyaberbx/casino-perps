import { describe, it, expect } from 'vitest'
import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { HyperliquidGatewayError } from '../../gateway/hyperliquid-gateway.types'
import type { HyperliquidTimeWindow } from '../../gateway/hyperliquid-gateway.types'
import { createPagedHistoryReader } from '../paged-history-reader'
import { buildFakeLogger } from '../__fixtures__/web-data2'

const ADDRESS = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const ADDRESS_B = '0x1111111111111111111111111111111111111111' as WalletAddress
const NOW = 1_000

interface Item {
  readonly t: number
  readonly k: string
}

type FetchFn = (
  address: WalletAddress,
  window: HyperliquidTimeWindow,
) => ResultAsync<ReadonlyArray<Item>, HyperliquidGatewayError>

function makeReader(
  order: 'ascending' | 'descending',
  fetch: FetchFn,
  opts: {
    getAddress?: () => WalletAddress | null
    budget?: number
    pageCapFloor?: number
    now?: () => number
  } = {},
) {
  return createPagedHistoryReader<Item, ReadonlyArray<Item>>({
    getAddress: opts.getAddress ?? (() => ADDRESS),
    logger: buildFakeLogger().logger,
    logModule: 'test-reader',
    order,
    now: opts.now ?? (() => NOW),
    budget: opts.budget ?? 10,
    pageCapFloor: opts.pageCapFloor ?? 2,
    fetch,
    project: (response) => response,
    getTime: (item) => item.t,
    getKey: (item) => item.k,
  })
}

describe('createPagedHistoryReader', () => {
  it('subscribe emits empty list synchronously and never fetches', () => {
    let calls = 0
    const reader = makeReader('ascending', () => {
      calls += 1
      return okAsync([])
    })
    const seen: Array<ReadonlyArray<Item>> = []
    reader.subscribe((next) => seen.push(next))
    expect(calls).toBe(0)
    expect(seen).toEqual([[]])
  })

  it('returns exhausted:true without fetching when the address is null', async () => {
    let calls = 0
    const reader = makeReader(
      'ascending',
      () => {
        calls += 1
        return okAsync([])
      },
      { getAddress: () => null },
    )
    const result = await reader.loadOlder()
    expect(calls).toBe(0)
    expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
  })

  describe('ascending order (ledger/funding/interest)', () => {
    it('a single short page loads fully, sorts newest-first, and exhausts in one fetch', async () => {
      const windows: HyperliquidTimeWindow[] = []
      const reader = makeReader('ascending', (_addr, window) => {
        windows.push(window)
        // Oldest-first as the HL endpoint returns it.
        return okAsync([{ t: 10, k: 'a' }]) // length 1 < capFloor 2 ⇒ complete
      })
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      expect(windows).toEqual([{ startTime: 0, endTime: NOW }])
      expect(seen[seen.length - 1]).toEqual([{ t: 10, k: 'a' }])
    })

    it('emits rows NEWEST-FIRST even though the source is oldest-first', async () => {
      const reader = makeReader('ascending', () =>
        okAsync([
          { t: 10, k: 'a' },
          { t: 30, k: 'c' },
          { t: 20, k: 'b' },
        ]),
      )
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      await reader.loadOlder()
      expect(seen[seen.length - 1]?.map((i) => i.k)).toEqual(['c', 'b', 'a'])
    })

    it('forward-pages from epoch until a short page, advancing startTime by the max time seen', async () => {
      const windows: HyperliquidTimeWindow[] = []
      const reader = makeReader('ascending', (_addr, window) => {
        windows.push(window)
        if (window.startTime === 0) return okAsync([{ t: 10, k: 'a' }, { t: 20, k: 'b' }]) // full page
        if (window.startTime === 20) return okAsync([{ t: 20, k: 'b' }, { t: 30, k: 'c' }]) // boundary re-included
        return okAsync([{ t: 30, k: 'c' }]) // short ⇒ done
      })
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      expect(windows).toEqual([
        { startTime: 0, endTime: NOW },
        { startTime: 20, endTime: NOW },
        { startTime: 30, endTime: NOW },
      ])
      // Boundary row 'b' de-duped; full set, newest-first.
      expect(seen[seen.length - 1]?.map((i) => i.k)).toEqual(['c', 'b', 'a'])
    })

    it('stops when the max time stops advancing (no progress)', async () => {
      let calls = 0
      const reader = makeReader('ascending', () => {
        calls += 1
        // Always returns a full page whose max time never advances past 20.
        return okAsync([{ t: 10, k: 'a' }, { t: 20, k: 'b' }])
      })
      reader.subscribe(() => {})
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      // Page 1 advances to 20; page 2 (startTime 20) does not advance ⇒ stop.
      expect(calls).toBe(2)
    })

    it('stops at the budget for an unbounded history and reports exhausted', async () => {
      let calls = 0
      const reader = makeReader(
        'ascending',
        () => {
          calls += 1
          const base = calls * 100
          return okAsync([{ t: base + 1, k: `${base}a` }, { t: base + 2, k: `${base}b` }])
        },
        { budget: 3 },
      )
      reader.subscribe(() => {})
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      expect(calls).toBe(3)
    })

    it('is a no-op after exhaustion', async () => {
      let calls = 0
      const reader = makeReader('ascending', () => {
        calls += 1
        return okAsync([{ t: 10, k: 'a' }])
      })
      reader.subscribe(() => {})
      await reader.loadOlder()
      await reader.loadOlder()
      expect(calls).toBe(1)
    })
  })

  describe('descending order (fills)', () => {
    it('pages the next-older window by an endTime cursor and accumulates newest-first', async () => {
      const windows: HyperliquidTimeWindow[] = []
      const reader = makeReader('descending', (_addr, window) => {
        windows.push(window)
        if (window.endTime === NOW) return okAsync([{ t: 50, k: 'x' }, { t: 40, k: 'y' }]) // newest-first
        if (window.endTime === 40) return okAsync([{ t: 40, k: 'y' }, { t: 30, k: 'z' }]) // boundary re-included
        return okAsync([{ t: 30, k: 'z' }]) // short ⇒ exhausted
      })
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))

      const r1 = await reader.loadOlder()
      expect(r1._unsafeUnwrap()).toEqual({ exhausted: false })
      const r2 = await reader.loadOlder()
      expect(r2._unsafeUnwrap()).toEqual({ exhausted: false })
      const r3 = await reader.loadOlder()
      expect(r3._unsafeUnwrap()).toEqual({ exhausted: true })

      expect(windows).toEqual([
        { startTime: 0, endTime: NOW },
        { startTime: 0, endTime: 40 },
        { startTime: 0, endTime: 30 },
      ])
      // 'y' de-duped across the boundary; all newest-first.
      expect(seen[seen.length - 1]?.map((i) => i.k)).toEqual(['x', 'y', 'z'])
    })

    it('exhausts immediately when the first page is short', async () => {
      const reader = makeReader('descending', () => okAsync([{ t: 50, k: 'x' }]))
      reader.subscribe(() => {})
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
    })
  })

  describe('scoping + lifecycle', () => {
    it('resets accumulated rows and refetches from scratch on address change', async () => {
      const windows: Array<{ addr: WalletAddress; window: HyperliquidTimeWindow }> = []
      let current: WalletAddress | null = ADDRESS
      const reader = makeReader(
        'ascending',
        (addr, window) => {
          windows.push({ addr, window })
          return okAsync([{ t: 10, k: addr === ADDRESS ? 'a' : 'b' }])
        },
        { getAddress: () => current },
      )
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      await reader.loadOlder()
      current = ADDRESS_B
      await reader.loadOlder()
      expect(windows[1]?.addr).toBe(ADDRESS_B)
      expect(windows[1]?.window).toEqual({ startTime: 0, endTime: NOW })
      expect(seen[seen.length - 1]?.map((i) => i.k)).toEqual(['b'])
    })

    it('discards a response that lands after the address rotated mid-load', async () => {
      let current: WalletAddress | null = ADDRESS
      let resolveFirst!: (rows: ReadonlyArray<Item>) => void
      const deferred = new Promise<ReadonlyArray<Item>>((r) => {
        resolveFirst = r
      })
      const reader = makeReader(
        'ascending',
        (addr) => {
          if (addr === ADDRESS) {
            return ResultAsync.fromPromise(deferred, () => new HyperliquidGatewayError('network', 'x'))
          }
          return okAsync([{ t: 99, k: 'fresh' }])
        },
        { getAddress: () => current },
      )
      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      const inflight = reader.loadOlder()
      current = ADDRESS_B
      resolveFirst([{ t: 1, k: 'stale' }])
      await inflight
      for (const emission of seen) {
        expect(emission.find((i) => i.k === 'stale')).toBeUndefined()
      }
    })

    it('last unsubscribe disposes internal state; resubscribe starts empty', async () => {
      let calls = 0
      const reader = makeReader('ascending', () => {
        calls += 1
        return okAsync([{ t: 10, k: 'a' }])
      })
      const seenA: Array<ReadonlyArray<Item>> = []
      const unsubA = reader.subscribe((next) => seenA.push(next))
      await reader.loadOlder()
      expect(seenA[seenA.length - 1]).toEqual([{ t: 10, k: 'a' }])
      unsubA()
      const seenB: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seenB.push(next))
      expect(seenB[0]).toEqual([])
      await reader.loadOlder()
      expect(calls).toBe(2)
      expect(seenB[seenB.length - 1]).toEqual([{ t: 10, k: 'a' }])
    })

    it('discards an in-flight response after dispose; a post-resubscribe loadOlder delivers rows', async () => {
      // The StrictMode seam: the dock's effect cleanup is the reader's last
      // unsubscribe (dispose rotates the generation) while the bootstrap fetch
      // is still in flight. The doomed response must be dropped, and the next
      // subscribe + loadOlder must fetch fresh rows under the new generation.
      let resolveFirst!: (rows: ReadonlyArray<Item>) => void
      let calls = 0
      const reader = makeReader('ascending', () => {
        calls += 1
        if (calls === 1) {
          const deferred = new Promise<ReadonlyArray<Item>>((r) => {
            resolveFirst = r
          })
          return ResultAsync.fromPromise(deferred, () => new HyperliquidGatewayError('network', 'x'))
        }
        return okAsync([{ t: 99, k: 'fresh' }])
      })
      const unsubscribe = reader.subscribe(() => {})
      const inflight = reader.loadOlder()
      unsubscribe() // last unsubscribe ⇒ dispose ⇒ generation rotates
      resolveFirst([{ t: 1, k: 'stale' }])
      await inflight

      const seen: Array<ReadonlyArray<Item>> = []
      reader.subscribe((next) => seen.push(next))
      expect(seen[0]).toEqual([]) // the stale response was never committed
      const result = await reader.loadOlder()
      expect(result._unsafeUnwrap()).toEqual({ exhausted: true })
      expect(calls).toBe(2)
      expect(seen[seen.length - 1]?.map((i) => i.k)).toEqual(['fresh'])
    })

    it('surfaces a mapped PortfolioHistoryFetchError and retries on the next call', async () => {
      let calls = 0
      const reader = makeReader('ascending', () => {
        calls += 1
        if (calls === 1) return errAsync(new HyperliquidGatewayError('rate-limited', 'slow'))
        return okAsync([{ t: 10, k: 'a' }])
      })
      reader.subscribe(() => {})
      const r1 = await reader.loadOlder()
      expect(r1.isErr()).toBe(true)
      expect(r1._unsafeUnwrapErr()).toEqual({ kind: 'rate-limited' })
      const r2 = await reader.loadOlder()
      expect(r2.isOk()).toBe(true)
      expect(calls).toBe(2)
    })
  })
})
