import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRecentMarketsStore } from '../recent-markets-store'

const KEY = 'perps-dex-recent-markets'

describe('createRecentMarketsStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('load', () => {
    it('is empty when nothing has been persisted', () => {
      const result = createRecentMarketsStore().load(KEY)
      expect(result._unsafeUnwrap()).toEqual({ version: 1, symbols: [] })
    })

    it('reads back what save wrote', () => {
      const store = createRecentMarketsStore()
      store.save(KEY, { version: 1, symbols: ['BTC', 'ETH'] })
      expect(store.load(KEY)._unsafeUnwrap()).toEqual({ version: 1, symbols: ['BTC', 'ETH'] })
    })

    // Degrade, don't throw: a corrupt value must not take the lobby down.
    it('degrades to empty on unparseable JSON', () => {
      localStorage.setItem(KEY, '{not json')
      expect(createRecentMarketsStore().load(KEY)._unsafeUnwrap()).toEqual({
        version: 1,
        symbols: [],
      })
    })

    it('degrades to empty on a stale/unknown shape', () => {
      localStorage.setItem(KEY, JSON.stringify({ version: 99, symbols: ['BTC'] }))
      expect(createRecentMarketsStore().load(KEY)._unsafeUnwrap()).toEqual({
        version: 1,
        symbols: [],
      })
    })

    it('degrades to empty on a bare array (never a valid shape for this store)', () => {
      localStorage.setItem(KEY, JSON.stringify(['BTC']))
      expect(createRecentMarketsStore().load(KEY)._unsafeUnwrap()).toEqual({
        version: 1,
        symbols: [],
      })
    })

    it('errs when localStorage.getItem itself throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('storage unavailable')
      })
      expect(createRecentMarketsStore().load(KEY)._unsafeUnwrapErr()).toBe('storage-read-failed')
    })
  })

  describe('save', () => {
    it('errs when localStorage.setItem throws (e.g. quota exceeded)', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
      const result = createRecentMarketsStore().save(KEY, { version: 1, symbols: ['BTC'] })
      expect(result._unsafeUnwrapErr()).toBe('storage-write-failed')
    })
  })
})
