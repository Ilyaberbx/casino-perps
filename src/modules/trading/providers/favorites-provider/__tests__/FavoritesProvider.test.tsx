/**
 * FavoritesProvider integration tests (Wave 3 — GREEN).
 *
 * Venue is mocked via vi.mock so the smart hook can call useSyncExternalStore
 * without a real venue being wired. The mock controls which markets are returned
 * by listMarkets() so reconciliation tests are fully deterministic.
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import type { Market } from '@/modules/shared/domain'

import { FavoritesProvider } from '..'
import { useFavoritesProvider } from '../use-favorites-provider'
import { FAVORITES_STORAGE_KEY } from '../../../trading.constants'

// --- Venue mock -----------------------------------------------------------

const mockListMarkets = vi.fn<() => Market[]>(() => [])
const mockSubscribeMarkets = vi.fn<(onChange: () => void) => () => void>(
  () => () => undefined,
)

vi.mock('@/modules/shared/providers/venue-provider', () => ({
  useCapability: () => ({
    listMarkets: mockListMarkets,
    subscribeMarkets: mockSubscribeMarkets,
    subscribeOrderbook: vi.fn(),
    subscribeTrades: vi.fn(),
    subscribeTicker: vi.fn(),
  }),
}))

// --- Wrapper --------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <FavoritesProvider>{children}</FavoritesProvider>
}

// --- Tests ----------------------------------------------------------------

describe('FavoritesProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    mockListMarkets.mockReturnValue([])
    mockSubscribeMarkets.mockReturnValue(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('favoriteSymbols is empty Set on first mount with no localStorage entry', () => {
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result.current.favoriteSymbols.size).toBe(0)
  })

  it('isFavorite returns false for any symbol when no favorites are stored', () => {
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result.current.isFavorite('BTC-PERP')).toBe(false)
  })

  it('isFavorite returns true after toggleFavorite is called for that symbol', () => {
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    act(() => {
      result.current.toggleFavorite('BTC-PERP')
    })
    expect(result.current.isFavorite('BTC-PERP')).toBe(true)
  })

  it('toggleFavorite persists to localStorage and survives remount', () => {
    const { result, unmount } = renderHook(() => useFavoritesProvider(), { wrapper })
    act(() => {
      result.current.toggleFavorite('BTC-PERP')
    })
    unmount()

    const { result: result2 } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result2.current.isFavorite('BTC-PERP')).toBe(true)
  })

  it('hydrates from versioned localStorage entry on mount', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ version: 1, symbols: ['ETH-PERP'] }),
    )
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result.current.isFavorite('ETH-PERP')).toBe(true)
  })

  it('migrates plain string[] entry and isFavorite returns true (WL-01 SC-3)', () => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['BTC-PERP']),
    )
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result.current.isFavorite('BTC-PERP')).toBe(true)
  })

  it('falls back to empty Set when localStorage read throws', () => {
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    expect(result.current.favoriteSymbols.size).toBe(0)
  })

  it('reconcileFavorites drops symbols absent from liveMarkets (WL-03)', () => {
    const { result } = renderHook(() => useFavoritesProvider(), { wrapper })
    act(() => {
      result.current.toggleFavorite('BTC-PERP')
    })
    expect(result.current.isFavorite('BTC-PERP')).toBe(true)

    act(() => {
      result.current.reconcileFavorites([{ symbol: 'ETH-PERP' } as Market])
    })
    expect(result.current.isFavorite('BTC-PERP')).toBe(false)
  })
})
