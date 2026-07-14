import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { useFavorites } from '../use-favorites'
import { useFavoritesOptional } from '../use-favorites-optional'
import { FakeFavoritesProvider } from '../__fixtures__/fake-favorites-provider'

describe('useFavorites', () => {
  it('throws when used outside FavoritesProvider', () => {
    expect(() => renderHook(() => useFavorites())).toThrow(
      'useFavoritesContext must be used within FavoritesProvider',
    )
  })

  it('returns favoriteSymbols, isFavorite, toggleFavorite, reconcileFavorites', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      FakeFavoritesProvider({ children })
    const { result } = renderHook(() => useFavorites(), { wrapper })
    expect(result.current).toHaveProperty('favoriteSymbols')
    expect(result.current).toHaveProperty('isFavorite')
    expect(result.current).toHaveProperty('toggleFavorite')
    expect(result.current).toHaveProperty('reconcileFavorites')
    expect(typeof result.current.isFavorite).toBe('function')
    expect(typeof result.current.toggleFavorite).toBe('function')
    expect(typeof result.current.reconcileFavorites).toBe('function')
  })
})

describe('useFavoritesOptional', () => {
  // The lobby renders outside FavoritesProvider under test and pre-provider paint;
  // it must degrade, not crash.
  it('returns null outside the provider instead of throwing', () => {
    const { result } = renderHook(() => useFavoritesOptional())
    expect(result.current).toBeNull()
  })

  it('returns the context value inside the provider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => FakeFavoritesProvider({ children })
    const { result } = renderHook(() => useFavoritesOptional(), { wrapper })
    expect(result.current).toHaveProperty('favoriteSymbols')
  })
})
