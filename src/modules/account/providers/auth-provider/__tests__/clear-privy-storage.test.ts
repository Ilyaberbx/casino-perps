import { describe, it, expect, afterEach, vi } from 'vitest'
import { clearPrivyStorage } from '../clear-privy-storage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('clearPrivyStorage', () => {
  it('removes every privy:-prefixed key', () => {
    localStorage.setItem('privy:token', 'a')
    localStorage.setItem('privy:refresh_token', 'b')
    localStorage.setItem('privy:caid', 'c')

    clearPrivyStorage()

    expect(localStorage.getItem('privy:token')).toBeNull()
    expect(localStorage.getItem('privy:refresh_token')).toBeNull()
    expect(localStorage.getItem('privy:caid')).toBeNull()
  })

  it('preserves keys that are not privy:-prefixed', () => {
    localStorage.setItem('privy:token', 'a')
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('perps-dex-favorites', '{"version":1,"symbols":[]}')

    clearPrivyStorage()

    expect(localStorage.getItem('privy:token')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('perps-dex-favorites')).toBe('{"version":1,"symbols":[]}')
  })

  it('degrades to a no-op (no throw) when localStorage access throws', () => {
    localStorage.setItem('privy:token', 'a')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(() => clearPrivyStorage()).not.toThrow()
  })
})
