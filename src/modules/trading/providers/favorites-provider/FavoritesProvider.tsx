import { useFavoritesProvider } from './use-favorites-provider'
import { FavoritesContext } from './favorites-provider.context'
import type { FavoritesProviderProps } from './favorites-provider.types'

export function FavoritesProvider({ children }: FavoritesProviderProps) {
  const state = useFavoritesProvider()
  return <FavoritesContext value={state}>{children}</FavoritesContext>
}
