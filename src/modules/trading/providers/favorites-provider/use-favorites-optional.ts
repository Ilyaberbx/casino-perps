import { useContext } from 'react'
import { FavoritesContext } from './favorites-provider.context'
import type { FavoritesContextValue } from './favorites-provider.types'

/**
 * `useFavorites` for consumers that legitimately render outside the provider.
 * Returns `null` instead of throwing.
 *
 * The lobby needs this: `useLobby` already reaches for `useVenueOptional` so the
 * page paints a clean loading state under test harnesses and any pre-venue
 * paint. Reading favorites through the throwing `useFavorites` would reintroduce
 * exactly the crash that `useVenueOptional` exists to avoid.
 */
export function useFavoritesOptional(): FavoritesContextValue | null {
  return useContext(FavoritesContext)
}
