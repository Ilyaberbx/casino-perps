import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWatchlistStore } from '../watchlist-store'

const KEY = 'spectate.watchlist.v1'
const ADDRESS_A = '0x1111111111111111111111111111111111111111'
const ADDRESS_B = '0x2222222222222222222222222222222222222222'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('createWatchlistStore', () => {
  describe('load', () => {
    it('returns empty entries when localStorage has no entry', () => {
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.version).toBe(1)
        expect(result.value.entries).toEqual([])
      }
    })

    it('returns versioned payload when localStorage has valid JSON', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, entries: [{ address: ADDRESS_A, label: 'Whale' }] }),
      )
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual([{ address: ADDRESS_A, label: 'Whale' }])
      }
    })

    it('round-trips entries without labels', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, entries: [{ address: ADDRESS_A }] }),
      )
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual([{ address: ADDRESS_A }])
      }
    })

    it('migrates a bare string[] of addresses to labelless entries', () => {
      localStorage.setItem(KEY, JSON.stringify([ADDRESS_A, ADDRESS_B]))
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual([{ address: ADDRESS_A }, { address: ADDRESS_B }])
      }
    })

    it('migrates a loose { addresses: string[] } shape to entries', () => {
      localStorage.setItem(KEY, JSON.stringify({ addresses: [ADDRESS_A] }))
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual([{ address: ADDRESS_A }])
      }
    })

    it('falls back to empty entries for corrupted input', () => {
      localStorage.setItem(KEY, JSON.stringify({ corrupted: true }))
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual([])
      }
    })

    it('returns err(storage-read-failed) when localStorage.getItem throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('storage unavailable')
      })
      const store = createWatchlistStore()
      const result = store.load(KEY)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBe('storage-read-failed')
      }
    })
  })

  describe('save', () => {
    it('round-trips: loaded payload matches saved payload (with and without labels)', () => {
      const store = createWatchlistStore()
      const payload = {
        version: 1 as const,
        entries: [{ address: ADDRESS_A, label: 'Whale' }, { address: ADDRESS_B }],
      }
      store.save(KEY, payload)
      const result = store.load(KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.entries).toEqual(payload.entries)
      }
    })

    it('returns err(storage-write-failed) when localStorage.setItem throws QuotaExceededError', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
      const store = createWatchlistStore()
      const result = store.save(KEY, { version: 1, entries: [] })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBe('storage-write-failed')
      }
      setItemSpy.mockRestore()
    })
  })
})
