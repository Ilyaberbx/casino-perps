import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { MarketSymbol } from '@/modules/trading'

const TRADE_PREFIX = '/trade/'

/** Derives the currently-open trade symbol from the path (`/trade/:symbol`) so
 * the search list can highlight it; empty when not on a trade route. */
function readTradeSymbol(pathname: string): MarketSymbol {
  if (!pathname.startsWith(TRADE_PREFIX)) return ''
  const segment = pathname.slice(TRADE_PREFIX.length)
  if (segment.length === 0) return ''
  return decodeURIComponent(segment)
}

export interface UseSearchOverlayParams {
  onClose: () => void
}

export interface UseSearchOverlayReturn {
  selectedMarket: MarketSymbol
  handleSelectMarket: (symbol: MarketSymbol) => void
}

/** Behaviour for the market-search overlay: pick a market → route to its trade
 * screen (`/trade/:symbol`, PRD 0008 D15) and close. The overlay lives above the
 * trade route's `SelectedMarketProvider`, so selection is a navigation, not a
 * `setSelectedMarket` call. */
export function useSearchOverlay({ onClose }: UseSearchOverlayParams): UseSearchOverlayReturn {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const selectedMarket = useMemo(() => readTradeSymbol(pathname), [pathname])

  const handleSelectMarket = useCallback(
    (symbol: MarketSymbol) => {
      navigate(`/trade/${encodeURIComponent(symbol)}`)
      onClose()
    },
    [navigate, onClose],
  )

  return { selectedMarket, handleSelectMarket }
}
