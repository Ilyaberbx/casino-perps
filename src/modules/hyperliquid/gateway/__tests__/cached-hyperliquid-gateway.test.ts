import { describe, it, expect, vi, afterEach } from 'vitest'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'
import { withGatewayCache } from '../cached-hyperliquid-gateway'
import { createLocalStorageCacheStore } from '../gateway-cache-store'
import { GATEWAY_CACHE_TTL_MS } from '../gateway-cache.constants'
import { HyperliquidGatewayError } from '../hyperliquid-gateway.types'
import type { UserFeesResponse } from '../sdk-types'
import {
  buildFakeGateway,
  buildFakeLogger,
  buildPortfolioPeriods,
  buildUserFees,
} from '../../services/__fixtures__/web-data2'
import { buildFakeCacheStore } from '../__fixtures__/fake-cache-store'

const ADDR = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca' as WalletAddress
const FEES_TTL = GATEWAY_CACHE_TTL_MS.getUserFees

function feesKey(address: WalletAddress): string {
  return `mainnet:getUserFees:${address}`
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('withGatewayCache', () => {
  it('serves a hit from the store without calling the inner gateway', async () => {
    let calls = 0
    const inner = buildFakeGateway({
      getUserFees: () => {
        calls += 1
        return okAsync(buildUserFees())
      },
    })
    const store = buildFakeCacheStore(() => 1000)
    store.map.set(feesKey(ADDR), { value: buildUserFees(), expiresAt: 999_999 })
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store,
    })
    const result = await gw.getUserFees(ADDR)
    expect(result.isOk()).toBe(true)
    expect(calls).toBe(0)
  })

  it('on a miss calls the inner gateway once and writes the entry with now()+ttl', async () => {
    let calls = 0
    const payload = buildUserFees()
    const inner = buildFakeGateway({
      getUserFees: () => {
        calls += 1
        return okAsync(payload)
      },
    })
    const store = buildFakeCacheStore(() => 1000)
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store,
    })
    const result = await gw.getUserFees(ADDR)
    expect(result._unsafeUnwrap()).toBe(payload)
    expect(calls).toBe(1)
    const entry = store.map.get(feesKey(ADDR))
    expect(entry?.value).toBe(payload)
    expect(entry?.expiresAt).toBe(1000 + FEES_TTL)
  })

  it('re-fetches once a cached entry has expired', async () => {
    let calls = 0
    const inner = buildFakeGateway({
      getUserFees: () => {
        calls += 1
        return okAsync(buildUserFees())
      },
    })
    const store = buildFakeCacheStore(() => 1000)
    store.map.set(feesKey(ADDR), { value: buildUserFees(), expiresAt: 0 }) // already expired
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store,
    })
    await gw.getUserFees(ADDR)
    expect(calls).toBe(1)
  })

  it('keys by argument so distinct addresses do not collide', async () => {
    const calls: WalletAddress[] = []
    const other = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as WalletAddress
    const inner = buildFakeGateway({
      getUserFees: (address) => {
        calls.push(address)
        return okAsync(buildUserFees())
      },
    })
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store: buildFakeCacheStore(() => 1000),
    })
    await gw.getUserFees(ADDR)
    await gw.getUserFees(other)
    expect(calls).toEqual([ADDR, other])
  })

  it('coalesces two concurrent identical reads onto one inner call (in-flight dedup)', async () => {
    let calls = 0
    // Definite assignment: the Promise executor runs synchronously, so `resolve`
    // is set before any test code reads it. Avoids closure-narrowing to `null`.
    let resolve!: () => void
    const gate = new Promise<void>((r) => {
      resolve = r
    })
    const inner = buildFakeGateway({
      getUserFees: () => {
        calls += 1
        return ResultAsync.fromSafePromise<UserFeesResponse, never>(
          gate.then(() => buildUserFees()),
        )
      },
    })
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store: buildFakeCacheStore(() => 1000),
    })
    const a = gw.getUserFees(ADDR)
    const b = gw.getUserFees(ADDR)
    expect(calls).toBe(1)
    resolve()
    await a
    await b
    expect(calls).toBe(1)
  })

  it('never caches an error and releases the in-flight slot so the next call retries', async () => {
    let calls = 0
    const inner = buildFakeGateway({
      getUserFees: () => {
        calls += 1
        return errAsync(new HyperliquidGatewayError('network', 'boom'))
      },
    })
    const store = buildFakeCacheStore(() => 1000)
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store,
    })
    const r1 = await gw.getUserFees(ADDR)
    expect(r1.isErr()).toBe(true)
    expect(store.writeCount()).toBe(0)
    await flushMicrotasks() // let the in-flight cleanup .then settle
    const r2 = await gw.getUserFees(ADDR)
    expect(r2.isErr()).toBe(true)
    expect(calls).toBe(2)
  })

  it('passes non-allowlisted methods straight through to the inner gateway', async () => {
    let calls = 0
    const inner = buildFakeGateway({
      getPortfolio: () => {
        calls += 1
        return okAsync(buildPortfolioPeriods())
      },
    })
    const gw = withGatewayCache(inner, {
      network: 'mainnet',
      logger: buildFakeLogger().logger,
      store: buildFakeCacheStore(() => 1000),
    })
    await gw.getPortfolio(ADDR)
    await gw.getPortfolio(ADDR)
    expect(calls).toBe(2) // uncached — both reach the inner gateway
  })
})

describe('createLocalStorageCacheStore — IO resilience', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('degrades to a miss when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    const store = createLocalStorageCacheStore(() => 1000)
    expect(store.read('mainnet:getUserFees:x')).toBeNull()
  })

  it('does not throw when localStorage.setItem throws (quota/disabled)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const store = createLocalStorageCacheStore(() => 1000)
    expect(() => store.write('mainnet:getUserFees:x', { ok: true }, 60_000)).not.toThrow()
  })

  it('round-trips a value within its TTL and expires it after', () => {
    let clock = 1000
    const store = createLocalStorageCacheStore(() => clock)
    store.write('mainnet:getUserFees:x', { tier: 'vip-2' }, 60_000)
    expect(store.read('mainnet:getUserFees:x')).toEqual({ tier: 'vip-2' })
    clock = 1000 + 60_000
    expect(store.read('mainnet:getUserFees:x')).toBeNull()
  })
})
