import { describe, expect, it } from 'vitest'
import {
  createRecentRecipientsStore,
  DEFAULT_RECENT_RECIPIENTS_LIMIT,
} from '../recent-recipients-store'
import { buildFakeLogger, buildFakeStorage } from '../__fixtures__/recent-recipients-store'

const PRIVY_ID = 'did:privy:abc123'
const KEY = `recent-recipients:${PRIVY_ID}`

const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const C = '0xcccccccccccccccccccccccccccccccccccccccc'

function newStore(initial: Record<string, string> = {}) {
  const storage = buildFakeStorage(initial)
  const fakeLogger = buildFakeLogger()
  const store = createRecentRecipientsStore({ storage, logger: fakeLogger.logger })
  return { store, storage, fakeLogger }
}

describe('createRecentRecipientsStore — load', () => {
  it('returns an empty list when no key is present', () => {
    const { store } = newStore()
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([])
  })

  it('returns the persisted list, lowercased', () => {
    const { store } = newStore({ [KEY]: JSON.stringify([A]) })
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([A.toLowerCase()])
  })

  it('drops malformed entries and dedups on load', () => {
    const { store } = newStore({ [KEY]: JSON.stringify([A, 'not-an-address', A.toLowerCase()]) })
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([A.toLowerCase()])
  })

  it('returns empty and warns when JSON is corrupted', () => {
    const { store, fakeLogger } = newStore({ [KEY]: '{not-json' })
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([])
    const warn = fakeLogger.records.find((r) => r.level === 'warn')
    expect(warn?.fields.module).toBe('recent-recipients-store')
  })

  it('returns empty and warns when the shape is invalid', () => {
    const { store, fakeLogger } = newStore({ [KEY]: JSON.stringify({ foo: 1 }) })
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([])
    expect(fakeLogger.records.some((r) => r.level === 'warn')).toBe(true)
  })
})

describe('createRecentRecipientsStore — record', () => {
  it('prepends a new recipient and persists it newest-first', () => {
    const { store } = newStore()
    store.record(PRIVY_ID, A)
    const list = store.record(PRIVY_ID, B)._unsafeUnwrap()
    expect(list).toEqual([B.toLowerCase(), A.toLowerCase()])
    expect(store.load(PRIVY_ID)._unsafeUnwrap()).toEqual([B.toLowerCase(), A.toLowerCase()])
  })

  it('moves an existing recipient to the front (dedup, case-insensitive)', () => {
    const { store } = newStore()
    store.record(PRIVY_ID, A)
    store.record(PRIVY_ID, B)
    const list = store.record(PRIVY_ID, A.toLowerCase())._unsafeUnwrap()
    expect(list).toEqual([A.toLowerCase(), B.toLowerCase()])
  })

  it('caps the list at the configured limit', () => {
    const storage = buildFakeStorage()
    const { logger } = buildFakeLogger()
    const store = createRecentRecipientsStore({ storage, logger, limit: 2 })
    store.record(PRIVY_ID, A)
    store.record(PRIVY_ID, B)
    const list = store.record(PRIVY_ID, C)._unsafeUnwrap()
    expect(list).toEqual([C.toLowerCase(), B.toLowerCase()])
  })

  it('ignores a malformed address without persisting it', () => {
    const { store, storage } = newStore()
    store.record(PRIVY_ID, A)
    const list = store.record(PRIVY_ID, '0xnope')._unsafeUnwrap()
    expect(list).toEqual([A.toLowerCase()])
    expect(storage.data.get(KEY)).toBe(JSON.stringify([A.toLowerCase()]))
  })

  it('defaults the cap to DEFAULT_RECENT_RECIPIENTS_LIMIT', () => {
    expect(DEFAULT_RECENT_RECIPIENTS_LIMIT).toBe(5)
  })
})
