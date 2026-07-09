import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Result } from 'neverthrow'
import { useVenueOptional } from '../../../shared/providers/venue-provider'
import type { Market } from '../../../shared/domain/domain.types'
import {
  SELECTED_MARKET_STORAGE_KEY,
  DEFAULT_SELECTED_MARKET,
} from './selected-market-provider.constants'
import {
  formatMarketParam,
  isMarketSymbol,
  parseMarketParam,
  resolveSelectedMarket,
} from './selected-market-provider.utils'

const NO_MARKETS: ReadonlyArray<Market> = []
import type {
  MarketSymbol,
  UseSelectedMarketProviderReturn,
} from './selected-market-provider.types'

const MARKET_QUERY_PARAM = 'market'

function readMarketFromStorage(): Result<MarketSymbol, Error> {
  return Result.fromThrowable(
    () => {
      const stored = localStorage.getItem(SELECTED_MARKET_STORAGE_KEY)
      const isValid = isMarketSymbol(stored)
      return isValid ? stored : DEFAULT_SELECTED_MARKET
    },
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )()
}

function writeMarketToStorage(market: MarketSymbol): Result<void, Error> {
  return Result.fromThrowable(
    () => {
      localStorage.setItem(SELECTED_MARKET_STORAGE_KEY, market)
    },
    (error) => (error instanceof Error ? error : new Error(String(error))),
  )()
}

function readMarketFromUrl(searchParams: URLSearchParams): MarketSymbol | null {
  const raw = searchParams.get(MARKET_QUERY_PARAM)
  if (raw === null) return null
  const parsed = parseMarketParam(raw)
  if (parsed === null) return null
  return isMarketSymbol(parsed.coin) ? parsed.coin : null
}

export function useSelectedMarketProvider(): UseSelectedMarketProviderReturn {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMarket, setSelectedMarketState] = useState<MarketSymbol>(() => {
    const fromUrl = readMarketFromUrl(searchParams)
    if (fromUrl !== null) return fromUrl
    const fromStorage = readMarketFromStorage()
    return fromStorage.isOk() ? fromStorage.value : DEFAULT_SELECTED_MARKET
  })

  useEffect(() => {
    writeMarketToStorage(selectedMarket)
  }, [selectedMarket])

  // Adopt an externally-changed `?market=` during render — React 19 idiom (no
  // setState-in-effect; the React Compiler bails out the in-progress render once
  // state agrees with the URL). A deep link, browser back/forward, or the global
  // hot-markets ticker navigating to `/trade?market=…` updates `searchParams`;
  // we reconcile it into state here. Guarded on inequality + validity so it
  // never loops and an invalid/absent param is ignored (storage/default win).
  const inboundUrlMarket = readMarketFromUrl(searchParams)
  if (inboundUrlMarket !== null && inboundUrlMarket !== selectedMarket) {
    setSelectedMarketState(inboundUrlMarket)
  }

  // Keep the URL in sync with state when it isn't already (mount hydration when
  // `?market=` is absent, and after a local selection). When the URL holds a
  // different valid market the render-time adoption above has already pulled it
  // into state, so this effect finds them equal and no-ops — no write/adopt war.
  useEffect(() => {
    const urlMarket = readMarketFromUrl(searchParams)
    if (urlMarket === selectedMarket) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set(MARKET_QUERY_PARAM, formatMarketParam(selectedMarket))
        return next
      },
      { replace: true },
    )
  }, [selectedMarket, searchParams, setSearchParams])

  const setSelectedMarket = useCallback(
    (market: MarketSymbol) => {
      setSelectedMarketState(market)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(MARKET_QUERY_PARAM, formatMarketParam(market))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const venue = useVenueOptional()
  const marketDataCap = venue?.capabilities.marketData ?? null

  const subscribeMarkets = useCallback(
    (onChange: () => void) => {
      if (marketDataCap === null) return () => {}
      return marketDataCap.subscribeMarkets(onChange)
    },
    [marketDataCap],
  )
  const getMarkets = useCallback(
    () => (marketDataCap === null ? NO_MARKETS : marketDataCap.listMarkets()),
    [marketDataCap],
  )
  const markets = useSyncExternalStore(subscribeMarkets, getMarkets)

  const market = useMemo(
    () => resolveSelectedMarket(selectedMarket, markets),
    [selectedMarket, markets],
  )

  return { selectedMarket, setSelectedMarket, market }
}
