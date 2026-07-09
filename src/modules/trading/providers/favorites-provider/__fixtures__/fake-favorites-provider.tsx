import type { ReactNode } from 'react'
import { FavoritesContext } from '../favorites-provider.context'
import type { FavoritesContextValue } from '../favorites-provider.types'

const defaultValue: FavoritesContextValue = {
  favoriteSymbols: new Set(),
  isFavorite: () => false,
  toggleFavorite: () => undefined,
  reconcileFavorites: () => undefined,
}

interface FakeFavoritesProviderProps {
  children: ReactNode
  value?: Partial<FavoritesContextValue>
}

export function FakeFavoritesProvider({ children, value }: FakeFavoritesProviderProps) {
  const merged: FavoritesContextValue = { ...defaultValue, ...value }
  return <FavoritesContext value={merged}>{children}</FavoritesContext>
}
