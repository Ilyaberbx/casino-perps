import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFavoritesStore } from '../favorites-store'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('createFavoritesStore', () => {
  describe('load', () => {
    it('returns empty symbols when localStorage has no entry', () => {
      const store = createFavoritesStore()
      const result = store.load('perps-dex-favorites')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.version).toBe(1)
        expect(result.value.symbols).toEqual([])
      }
    })

    it('returns versioned payload when localStorage has valid JSON', () => {
      localStorage.setItem(
        'perps-dex-favorites',
        JSON.stringify({ version: 1, symbols: ['BTC-PERP'] }),
      )
      const store = createFavoritesStore()
      const result = store.load('perps-dex-favorites')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.version).toBe(1)
        expect(result.value.symbols).toEqual(['BTC-PERP'])
      }
    })

    it('migrates plain string[] to { version: 1, symbols } (WL-01 SC-3)', () => {
      localStorage.setItem('perps-dex-favorites', JSON.stringify(['BTC-PERP']))
      const store = createFavoritesStore()
      const result = store.load('perps-dex-favorites')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.version).toBe(1)
        expect(result.value.symbols).toEqual(['BTC-PERP'])
      }
    })

    it('falls back to empty symbols for corrupted {} input (WL-01 SC-3)', () => {
      localStorage.setItem('perps-dex-favorites', JSON.stringify({ corrupted: true }))
      const store = createFavoritesStore()
      const result = store.load('perps-dex-favorites')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.symbols).toEqual([])
      }
    })

    it('returns err(storage-read-failed) when localStorage.getItem throws', () => {
      vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
        throw new Error('storage unavailable')
      })
      const store = createFavoritesStore()
      const result = store.load('perps-dex-favorites')
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBe('storage-read-failed')
      }
    })

    it('save round-trips: loaded payload matches saved payload', () => {
      const store = createFavoritesStore()
      const payload = { version: 1 as const, symbols: ['BTC-PERP', 'ETH-PERP'] }
      store.save('perps-dex-favorites', payload)
      const result = store.load('perps-dex-favorites')
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.symbols).toEqual(payload.symbols)
      }
    })

    it('returns err(storage-write-failed) when localStorage.setItem throws QuotaExceededError', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
      const store = createFavoritesStore()
      const result = store.save('perps-dex-favorites', { version: 1, symbols: [] })
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error).toBe('storage-write-failed')
      }
      setItemSpy.mockRestore()
    })
  })
})
