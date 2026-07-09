import { createContext, useContext } from 'react'
import type { FavoritesContextValue } from './favorites-provider.types'

export const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function useFavoritesContext(): FavoritesContextValue {
  const context = useContext(FavoritesContext)
  const isContextMissing = context === null
  if (isContextMissing) {
    throw new Error('useFavoritesContext must be used within FavoritesProvider')
  }
  return context
}
