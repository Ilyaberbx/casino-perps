import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { parseWalletAddress } from '@/modules/shared/domain'
import { toast } from '@/modules/shared/services/toast'
import { useSpectateProvider } from '../use-spectate-provider'

const ADDRESS_A = '0x1111111111111111111111111111111111111111'
const ADDRESS_B = '0x2222222222222222222222222222222222222222'

function wrapper(initialEntries: string[] = ['/portfolio']) {
  return ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries }, children)
}

function useProviderAndLocation(isWalletConnected = true) {
  const spectate = useSpectateProvider(isWalletConnected)
  const location = useLocation()
  return { spectate, location }
}

function parsedAddress(input: string) {
  const result = parseWalletAddress(input)
  if (result.isErr()) throw result.error
  return result.value
}

describe('useSpectateProvider — watchlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with an empty watchlist when storage is empty', () => {
    const { result } = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    expect(result.current.watchlist).toEqual([])
    expect(result.current.isWatchlisted(parsedAddress(ADDRESS_A))).toBe(false)
  })

  it('addToWatchlist adds an entry and reflects in isWatchlisted', () => {
    const { result } = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.addToWatchlist({ address: parsedAddress(ADDRESS_A), label: 'Whale' })
    })
    expect(result.current.watchlist).toEqual([{ address: ADDRESS_A, label: 'Whale' }])
    expect(result.current.isWatchlisted(parsedAddress(ADDRESS_A))).toBe(true)
  })

  it('addToWatchlist updates the label when re-adding the same address', () => {
    const { result } = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.addToWatchlist({ address: parsedAddress(ADDRESS_A), label: 'Whale' })
    })
    act(() => {
      result.current.addToWatchlist({ address: parsedAddress(ADDRESS_A), label: 'Renamed' })
    })
    expect(result.current.watchlist).toEqual([{ address: ADDRESS_A, label: 'Renamed' }])
  })

  it('removeFromWatchlist removes the entry', () => {
    const { result } = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    act(() => {
      result.current.addToWatchlist({ address: parsedAddress(ADDRESS_A) })
    })
    act(() => {
      result.current.removeFromWatchlist(parsedAddress(ADDRESS_A))
    })
    expect(result.current.watchlist).toEqual([])
    expect(result.current.isWatchlisted(parsedAddress(ADDRESS_A))).toBe(false)
  })

  it('persists the watchlist to localStorage across remounts', () => {
    const first = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    act(() => {
      first.result.current.addToWatchlist({ address: parsedAddress(ADDRESS_B), label: 'Saved' })
    })
    const second = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    expect(second.result.current.watchlist).toEqual([{ address: ADDRESS_B, label: 'Saved' }])
  })
})

describe('useSpectateProvider', () => {
  it('is not spectating when ?spectate= is absent', () => {
    const { result } = renderHook(() => useSpectateProvider(), { wrapper: wrapper() })
    expect(result.current.isSpectating).toBe(false)
    expect(result.current.spectatedAddress).toBeNull()
  })

  it('hydrates spectatedAddress from a present ?spectate= param', () => {
    const { result } = renderHook(() => useSpectateProvider(), {
      wrapper: wrapper([`/portfolio?spectate=${ADDRESS_A}`]),
    })
    expect(result.current.isSpectating).toBe(true)
    expect(result.current.spectatedAddress).toBe(ADDRESS_A)
  })

  it('ignores an invalid ?spectate= param', () => {
    const { result } = renderHook(() => useSpectateProvider(), {
      wrapper: wrapper(['/portfolio?spectate=not-an-address']),
    })
    expect(result.current.isSpectating).toBe(false)
    expect(result.current.spectatedAddress).toBeNull()
  })

  it('startSpectating writes the address to the ?spectate= param', () => {
    const { result } = renderHook(() => useProviderAndLocation(), { wrapper: wrapper() })
    act(() => {
      result.current.spectate.startSpectating(parsedAddress(ADDRESS_B))
    })
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('spectate')).toBe(ADDRESS_B)
    expect(result.current.spectate.spectatedAddress).toBe(ADDRESS_B)
    expect(result.current.spectate.isSpectating).toBe(true)
  })

  it('stopSpectating clears the ?spectate= param', () => {
    const { result } = renderHook(() => useProviderAndLocation(), {
      wrapper: wrapper([`/portfolio?spectate=${ADDRESS_A}`]),
    })
    expect(result.current.spectate.isSpectating).toBe(true)
    act(() => {
      result.current.spectate.stopSpectating()
    })
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('spectate')).toBeNull()
    expect(result.current.spectate.spectatedAddress).toBeNull()
    expect(result.current.spectate.isSpectating).toBe(false)
  })
})

describe('useSpectateProvider — wallet gating', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('startSpectating is a no-op and warns when no wallet is connected', () => {
    const showToast = vi.spyOn(toast, 'show')
    const { result } = renderHook(() => useProviderAndLocation(false), { wrapper: wrapper() })
    act(() => {
      result.current.spectate.startSpectating(parsedAddress(ADDRESS_B))
    })
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('spectate')).toBeNull() // no ?spectate= written
    expect(result.current.spectate.isSpectating).toBe(false) // no plaque
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'warning', title: 'Connect wallet first' }),
    )
  })

  it('ignores a ?spectate= URL while disconnected — no plaque, no re-key, no toast', () => {
    const showToast = vi.spyOn(toast, 'show')
    const { result } = renderHook(() => useProviderAndLocation(false), {
      wrapper: wrapper([`/portfolio?spectate=${ADDRESS_A}`]),
    })
    // The override is not honoured while disconnected: no plaque, no re-key.
    expect(result.current.spectate.isSpectating).toBe(false)
    expect(result.current.spectate.spectatedAddress).toBeNull()
    // The param is left intact (no strip) so a shared link / cold reload resumes
    // spectating once the wallet connects — and a passive load is not "trying to
    // spectate", so no toast fires.
    const params = new URLSearchParams(result.current.location.search)
    expect(params.get('spectate')).toBe(ADDRESS_A)
    expect(showToast).not.toHaveBeenCalled()
  })

  it('resumes the ?spectate= override the moment the wallet connects', () => {
    // Same URL, but connected: the link that was inert while disconnected now
    // activates — proving "ignore, don't strip" keeps shared links shareable.
    const { result } = renderHook(() => useProviderAndLocation(true), {
      wrapper: wrapper([`/portfolio?spectate=${ADDRESS_A}`]),
    })
    expect(result.current.spectate.isSpectating).toBe(true)
    expect(result.current.spectate.spectatedAddress).toBe(ADDRESS_A)
  })
})
