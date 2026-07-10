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

export function useSelectedMarketProvider(
  initialSymbol?: string,
): UseSelectedMarketProviderReturn {
  const [searchParams, setSearchParams] = useSearchParams()

  // Path-driven mode (PRD 0008 D15): when a route `:symbol` is supplied, the
  // path — owned by the router — is the URL source of truth. The provider then
  // adopts inbound path changes and stops writing the legacy `?market=` query.
  // Absent the prop, behaviour is unchanged (query-driven).
  const isPathDriven = initialSymbol !== undefined
  const pathSymbol = isPathDriven && isMarketSymbol(initialSymbol) ? initialSymbol : null

  const [selectedMarket, setSelectedMarketState] = useState<MarketSymbol>(() => {
    if (pathSymbol !== null) return pathSymbol
    const fromUrl = readMarketFromUrl(searchParams)
    if (fromUrl !== null) return fromUrl
    const fromStorage = readMarketFromStorage()
    return fromStorage.isOk() ? fromStorage.value : DEFAULT_SELECTED_MARKET
  })

  useEffect(() => {
    writeMarketToStorage(selectedMarket)
  }, [selectedMarket])

  // Path-driven: adopt an inbound path-symbol change during render (deep link,
  // search-overlay/lobby navigation to `/trade/:symbol`). Same React 19 idiom as
  // the query path below — guarded on inequality so it converges, never loops.
  const shouldAdoptPathSymbol = pathSymbol !== null && pathSymbol !== selectedMarket
  if (shouldAdoptPathSymbol) {
    setSelectedMarketState(pathSymbol)
  }

  // Query-driven: adopt an externally-changed `?market=` during render — a deep
  // link, browser back/forward, or the hot-markets ticker navigating to
  // `/trade?market=…`. Skipped in path-driven mode (the router owns the URL).
  const inboundUrlMarket = readMarketFromUrl(searchParams)
  const shouldAdoptUrlMarket =
    !isPathDriven && inboundUrlMarket !== null && inboundUrlMarket !== selectedMarket
  if (shouldAdoptUrlMarket) {
    setSelectedMarketState(inboundUrlMarket)
  }

  // Keep the `?market=` query in sync with state (query-driven mode only). When
  // path-driven the router owns the URL, so this is a no-op.
  useEffect(() => {
    if (isPathDriven) return
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
  }, [selectedMarket, searchParams, setSearchParams, isPathDriven])

  const setSelectedMarket = useCallback(
    (market: MarketSymbol) => {
      setSelectedMarketState(market)
      if (isPathDriven) return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(MARKET_QUERY_PARAM, formatMarketParam(market))
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams, isPathDriven],
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
