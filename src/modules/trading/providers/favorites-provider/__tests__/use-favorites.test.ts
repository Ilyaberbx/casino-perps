import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { useFavorites } from '../use-favorites'
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
