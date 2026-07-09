import { useState, useCallback, useMemo } from 'react'
import { SUBSCRIPTION_KEY_NONE } from '../../trading.constants'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { useFavorites } from '../../providers/favorites-provider'
import { useIsMobile } from '@/modules/shared/hooks/use-is-mobile'
import { useTicker } from './use-ticker'
import { deriveMarketHeaderLabel, deriveMarketStripStats } from './top-bar.utils'
import type { MarketSymbol } from '../../providers/selected-market-provider'
import type { UseTopBarReturn } from './top-bar.types'

export function useTopBar(): UseTopBarReturn {
  const { selectedMarket, setSelectedMarket, market } = useSelectedMarketContext()
  const ticker = useTicker(market.hlCoin ?? SUBSCRIPTION_KEY_NONE)
  const isMobile = useIsMobile()

  const [isWindowOpen, setIsWindowOpen] = useState(false)

  const openWindow = useCallback(() => setIsWindowOpen(true), [])
  const closeWindow = useCallback(() => setIsWindowOpen(false), [])
  const handleSelectMarket = useCallback(
    (symbol: MarketSymbol) => {
      setSelectedMarket(symbol)
      setIsWindowOpen(false)
    },
    [setSelectedMarket],
  )

  const { isFavorite: checkFavorite, toggleFavorite: toggleFavoriteInStore } = useFavorites()
  const isFavorite = checkFavorite(selectedMarket)
  const toggleFavorite = useCallback(() => {
    toggleFavoriteInStore(selectedMarket)
  }, [toggleFavoriteInStore, selectedMarket])

  const stats = useMemo(
    () => (ticker === null ? null : deriveMarketStripStats(ticker, market, market.volume24h)),
    [ticker, market],
  )

  const marketHeaderLabel = useMemo(() => deriveMarketHeaderLabel(market), [market])

  // market is always a resolved Market object from useSelectedMarketContext; the
  // guard is a belt-and-suspenders check against an unexpectedly absent baseAsset.
  const hasResolvedMarket = typeof market === 'object' && market !== null && 'baseAsset' in market

  // Directional mark-price flash (ADR-0043). Derive the up/down for this tick by
  // comparing to the previous mark, using React's supported "adjust state during
  // render" pattern (https://react.dev/reference/react/useState#storing-information-from-previous-renders):
  // the guard makes it run only on a real change, so no loop and no ref read in
  // render. The flash replays by keying the price element on its text downstream.
  const markPrice = ticker?.markPrice ?? null
  const [prevMarkPrice, setPrevMarkPrice] = useState<number | null>(null)
  const [markFlash, setMarkFlash] = useState<'up' | 'down' | null>(null)
  if (markPrice !== null && markPrice !== prevMarkPrice) {
    setMarkFlash(prevMarkPrice === null ? null : markPrice > prevMarkPrice ? 'up' : 'down')
    setPrevMarkPrice(markPrice)
  }

  return {
    selectedMarket,
    market,
    marketHeaderLabel,
    hasResolvedMarket,
    setSelectedMarket,
    isMobile,
    isWindowOpen,
    openWindow,
    closeWindow,
    handleSelectMarket,
    ticker,
    stats,
    markFlash,
    isFavorite,
    toggleFavorite,
  }
}
