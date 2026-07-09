import { useFavoritesContext } from './favorites-provider.context'
import type { FavoritesContextValue } from './favorites-provider.types'

export function useFavorites(): FavoritesContextValue {
  return useFavoritesContext()
}
