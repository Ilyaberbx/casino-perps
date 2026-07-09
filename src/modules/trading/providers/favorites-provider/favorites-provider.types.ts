import type { ReactNode } from 'react'
import type { Market } from '@/modules/shared/domain'
import type { MarketSymbol } from '../selected-market-provider'

export interface FavoritesContextValue {
  favoriteSymbols: ReadonlySet<MarketSymbol>
  isFavorite: (symbol: MarketSymbol) => boolean
  toggleFavorite: (symbol: MarketSymbol) => void
  reconcileFavorites: (liveMarkets: Market[]) => void
}

export interface FavoritesProviderProps {
  children: ReactNode
}
