import { useState, useCallback, useMemo, useEffect, useSyncExternalStore, startTransition } from 'react'
import type { Market } from '@/modules/shared/domain'
import { useCapability } from '../../../shared/providers/venue-provider'
import { createFavoritesStore } from '../../services/favorites-store'
import { reconcileFavorites as computeReconciled } from '../../trading.utils'
import { FAVORITES_STORAGE_KEY } from '../../trading.constants'
import type { MarketSymbol } from '../selected-market-provider'
import type { FavoritesContextValue } from './favorites-provider.types'

export function useFavoritesProvider(): FavoritesContextValue {
  const marketDataCap = useCapability('marketData')

  const subscribeMarkets = useCallback(
    (onChange: () => void) => marketDataCap.subscribeMarkets(onChange),
    [marketDataCap],
  )
  const getMarkets = useCallback(() => marketDataCap.listMarkets(), [marketDataCap])
  const markets = useSyncExternalStore(subscribeMarkets, getMarkets)

  const store = useMemo(() => createFavoritesStore(), [])

  const [symbols, setSymbols] = useState<ReadonlySet<MarketSymbol>>(() => {
    const result = store.load(FAVORITES_STORAGE_KEY)
    const payload = result.isOk() ? result.value : { version: 1 as const, symbols: [] }
    return new Set(payload.symbols)
  })

  const persist = useCallback(
    (next: ReadonlySet<MarketSymbol>) => {
      store.save(FAVORITES_STORAGE_KEY, { version: 1, symbols: [...next] })
    },
    [store],
  )

  const toggleFavorite = useCallback(
    (symbol: MarketSymbol) => {
      setSymbols((current) => {
        const next = new Set(current)
        const wasFavorite = next.has(symbol)
        if (wasFavorite) next.delete(symbol)
        if (!wasFavorite) next.add(symbol)
        persist(next)
        return next
      })
    },
    [persist],
  )

  const reconcileFavorites = useCallback(
    (liveMarkets: Market[]) => {
      setSymbols((current) => {
        const reconciled = computeReconciled(current, liveMarkets)
        const hasChanged = reconciled.size !== current.size
        if (hasChanged) persist(reconciled)
        return hasChanged ? reconciled : current
      })
    },
    [persist],
  )

  useEffect(() => {
    const hasMarkets = markets.length > 0
    if (!hasMarkets) return
    startTransition(() => {
      reconcileFavorites(markets)
    })
  }, [markets, reconcileFavorites])

  const isFavorite = useCallback(
    (symbol: MarketSymbol) => symbols.has(symbol),
    [symbols],
  )

  return { favoriteSymbols: symbols, isFavorite, toggleFavorite, reconcileFavorites }
}
