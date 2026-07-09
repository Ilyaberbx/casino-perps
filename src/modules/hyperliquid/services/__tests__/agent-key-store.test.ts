import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WalletAddress } from '@/modules/shared/domain'
import { createAgentKeyStore } from '../agent-key-store'

const MASTER = '0xabcdef0123456789abcdef0123456789abcdef01' as WalletAddress
const OTHER = '0x1111111111111111111111111111111111111111' as WalletAddress
const VALID_KEY = `0x${'0'.repeat(64)}` as `0x${string}`
const NETWORK = 'testnet'

beforeEach(() => {
  localStorage.clear()
})

describe('createAgentKeyStore', () => {
  describe('load', () => {
    it('returns ok(null) when localStorage has no entry', () => {
      const store = createAgentKeyStore()
      const result = store.load(MASTER, NETWORK)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeNull()
    })

    it('returns ok(key) when localStorage has a valid hex key', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      const result = store.load(MASTER, NETWORK)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(VALID_KEY)
    })

    it('returns err("invalid-stored-key") when localStorage has a non-hex value', () => {
      localStorage.setItem(`hl-agent-key:${MASTER.toLowerCase()}:${NETWORK}`, 'corrupted')
      const store = createAgentKeyStore()
      const result = store.load(MASTER, NETWORK)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error).toBe('invalid-stored-key')
    })

    it('returns err("invalid-stored-key") when localStorage has a valid-looking hex but wrong length (63 chars)', () => {
      const shortKey = `0x${'a'.repeat(63)}`
      localStorage.setItem(`hl-agent-key:${MASTER.toLowerCase()}:${NETWORK}`, shortKey)
      const store = createAgentKeyStore()
      const result = store.load(MASTER, NETWORK)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error).toBe('invalid-stored-key')
    })

    it('round-trips a key correctly after save', () => {
      const store = createAgentKeyStore()
      const key = `0x${'c'.repeat(64)}` as `0x${string}`
      store.save(MASTER, NETWORK, key)
      const result = store.load(MASTER, NETWORK)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBe(key)
    })

    it('uses the correct storage key format (D-01 scoping)', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      const expectedKey = `hl-agent-key:${MASTER.toLowerCase()}:${NETWORK}`
      expect(localStorage.getItem(expectedKey)).toBe(VALID_KEY)
    })

    it('different master addresses produce different storage keys (no cross-account bleed)', () => {
      const store = createAgentKeyStore()
      const keyA = `0x${'a'.repeat(64)}` as `0x${string}`
      const keyB = `0x${'b'.repeat(64)}` as `0x${string}`
      store.save(MASTER, NETWORK, keyA)
      store.save(OTHER, NETWORK, keyB)
      const resultA = store.load(MASTER, NETWORK)
      const resultB = store.load(OTHER, NETWORK)
      expect(resultA.isOk()).toBe(true)
      expect(resultB.isOk()).toBe(true)
      if (resultA.isOk() && resultB.isOk()) {
        expect(resultA.value).toBe(keyA)
        expect(resultB.value).toBe(keyB)
        expect(resultA.value).not.toBe(resultB.value)
      }
    })
  })

  describe('save', () => {
    it('returns ok(undefined) on a normal write and key round-trips via load()', () => {
      const store = createAgentKeyStore()
      const result = store.save(MASTER, NETWORK, VALID_KEY)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) expect(result.value).toBeUndefined()
      const loaded = store.load(MASTER, NETWORK)
      expect(loaded.isOk()).toBe(true)
      if (loaded.isOk()) expect(loaded.value).toBe(VALID_KEY)
    })

    it('returns err("storage-write-failed") and does not throw when localStorage.setItem throws', () => {
      const store = createAgentKeyStore()
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      })
      let result
      expect(() => {
        result = store.save(MASTER, NETWORK, VALID_KEY)
      }).not.toThrow()
      expect(result!.isErr()).toBe(true)
      if (result!.isErr()) expect(result!.error).toBe('storage-write-failed')
      setItemSpy.mockRestore()
    })
  })

  // SEC-M1: the agent private key must be wiped on logout/disconnect, not left
  // in cleartext localStorage past the session. write → clear → load is empty.
  describe('clear', () => {
    it('removes the stored key for the given account so load() returns ok(null)', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      const result = store.clear(MASTER, NETWORK)
      expect(result.isOk()).toBe(true)
      const loaded = store.load(MASTER, NETWORK)
      expect(loaded.isOk()).toBe(true)
      if (loaded.isOk()) expect(loaded.value).toBeNull()
      expect(localStorage.getItem(makeKey(MASTER, NETWORK))).toBeNull()
    })

    it('leaves OTHER accounts/networks untouched (targeted, not a sweep)', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      store.save(OTHER, NETWORK, VALID_KEY)
      store.clear(MASTER, NETWORK)
      expect(localStorage.getItem(makeKey(MASTER, NETWORK))).toBeNull()
      expect(localStorage.getItem(makeKey(OTHER, NETWORK))).toBe(VALID_KEY)
    })

    it('returns ok(undefined) when there is no entry to remove', () => {
      const store = createAgentKeyStore()
      const result = store.clear(MASTER, NETWORK)
      expect(result.isOk()).toBe(true)
    })

    it('returns err("storage-write-failed") and does not throw when removeItem throws', () => {
      const store = createAgentKeyStore()
      const spy = vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
        throw new DOMException('SecurityError', 'SecurityError')
      })
      let result
      expect(() => {
        result = store.clear(MASTER, NETWORK)
      }).not.toThrow()
      expect(result!.isErr()).toBe(true)
      if (result!.isErr()) expect(result!.error).toBe('storage-write-failed')
      spy.mockRestore()
    })
  })

  describe('clearAll', () => {
    it('removes EVERY hl-agent-key entry across accounts and networks', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      store.save(OTHER, NETWORK, VALID_KEY)
      store.save(MASTER, 'mainnet', VALID_KEY)
      const result = store.clearAll()
      expect(result.isOk()).toBe(true)
      expect(localStorage.getItem(makeKey(MASTER, NETWORK))).toBeNull()
      expect(localStorage.getItem(makeKey(OTHER, NETWORK))).toBeNull()
      expect(localStorage.getItem(makeKey(MASTER, 'mainnet'))).toBeNull()
    })

    it('leaves non-agent-key entries (e.g. privy:) untouched', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      localStorage.setItem('privy:session', 'keep-me')
      store.clearAll()
      expect(localStorage.getItem(makeKey(MASTER, NETWORK))).toBeNull()
      expect(localStorage.getItem('privy:session')).toBe('keep-me')
    })

    it('returns ok(undefined) when there are no agent keys to clear', () => {
      const store = createAgentKeyStore()
      expect(store.clearAll().isOk()).toBe(true)
    })

    it('returns err("storage-write-failed") and does not throw when removeItem throws mid-sweep', () => {
      const store = createAgentKeyStore()
      store.save(MASTER, NETWORK, VALID_KEY)
      const spy = vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
        throw new DOMException('SecurityError', 'SecurityError')
      })
      let result
      expect(() => {
        result = store.clearAll()
      }).not.toThrow()
      expect(result!.isErr()).toBe(true)
      if (result!.isErr()) expect(result!.error).toBe('storage-write-failed')
      spy.mockRestore()
    })
  })
})

function makeKey(address: WalletAddress, network: string) {
  return `hl-agent-key:${address.toLowerCase()}:${network}`
}
