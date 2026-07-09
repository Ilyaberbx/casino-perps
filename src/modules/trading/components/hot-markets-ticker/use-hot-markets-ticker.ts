import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVenueOptional } from '@/modules/shared/providers/venue-provider'
import type { Market } from '@/modules/shared/domain'
import {
  buildTradeMarketHref,
  parseMarketParam,
} from '../../providers/selected-market-provider/selected-market-provider.utils'
import type { MarketSymbol } from '../../providers/selected-market-provider'
import { pickHotMarkets } from './hot-markets-ticker.utils'
import {
  HOT_MARKET_LIMIT,
  MIN_MARQUEE_DURATION_SEC,
  SECONDS_PER_ITEM,
} from './hot-markets-ticker.constants'
import type { UseHotMarketsTickerReturn } from './hot-markets-ticker.types'

const NO_MARKETS: ReadonlyArray<Market> = []
const MARKET_QUERY_PARAM = 'market'

/** Significant figures kept when bucketing a market's 24h volume. Coarse enough
 *  that sub-0.1% per-tick jitter maps to the same bucket (so the top-N order
 *  holds), fine enough that a real volume move crosses a bucket and re-ranks. */
const VOLUME_SIGNIFICANT_FIGURES = 3

/** Coarse volume bucket for a market. Two volumes that differ only by jitter
 *  below the significant-figure cutoff share a bucket, so the stability signal
 *  is unchanged and the ranking memo is reused. Purely a memo-keying device — it
 *  never feeds the ranking itself, so it cannot change `pickHotMarkets` output. */
function bucketVolume(volume24h: number | undefined): number {
  const volume = volume24h ?? 0
  if (volume === 0) return 0
  const magnitude = Math.floor(Math.log10(Math.abs(volume)))
  const scale = 10 ** (magnitude - (VOLUME_SIGNIFICANT_FIGURES - 1))
  return Math.round(volume / scale) * scale
}

/** Cheap per-tick stability signal over the whole universe: each market's symbol
 *  paired with its coarse volume bucket. Unchanged across a price-only tick, so
 *  the ranking memo skips the full clone + sort. O(n) and allocation-light versus
 *  the previous O(n log n) sort that ran on every tick. */
function computeStabilitySignal(markets: ReadonlyArray<Market>): string {
  return markets.map((m) => `${m.symbol}:${bucketVolume(m.volume24h)}`).join(',')
}

/**
 * Smart hook for the global-header hot-markets ticker. Route-independent — it
 * reads the venue market universe via the `marketData` capability (the same
 * `useSyncExternalStore` wiring the selected-market provider uses) and navigates
 * to `/trade?market=…` on click. It deliberately does NOT consume
 * `SelectedMarketProvider` (that context only exists inside the /trade route),
 * so it can render in the app header on any page.
 */
export function useHotMarketsTicker(): UseHotMarketsTickerReturn {
  const venue = useVenueOptional()
  const marketDataCap = venue?.capabilities.marketData ?? null
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

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

  const isLoading = markets.length === 0

  // The hook re-runs on every market-data tick (the store pushes a fresh
  // `markets` array reference each tick), so `markets` identity is useless as a
  // memo key — it changes constantly even when the ranking is unaffected. We key
  // the expensive ranking on a cheap *stability signal* instead: each market's
  // symbol plus a coarse volume bucket. A price-only tick (or a volume wiggle too
  // small to cross a bucket boundary) leaves this key byte-identical, so the
  // full clone + sort + slice is skipped and the top-N order stays stable — the
  // documented intent that the marquee never jumps on per-tick wiggles. The first
  // computation for any distinct bucket configuration is exactly
  // `pickHotMarkets(markets)`, so the ranking output matches the unmemoized code.
  const stabilityKey = computeStabilitySignal(markets)

  // Ranked top-N symbols + their order. Folds `symbolsKey` into one memo so the
  // joined-symbol string isn't recomputed independently every tick.
  const { hotSymbols } = useMemo(() => {
    const ranked = pickHotMarkets([...markets], HOT_MARKET_LIMIT)
    return { hotSymbols: ranked.map((m) => m.symbol) }
    // `stabilityKey` is the intended dependency; `markets` is read inside but its
    // per-tick identity churn is deliberately not a trigger (see comment above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stabilityKey])

  // Latest Market object per hot symbol, rebuilt each tick so the live 24h % stays
  // fresh while the order holds. Scoped to the top-N symbols, not the whole
  // universe — the previous Map-over-the-entire-universe was the per-tick cost.
  const bySymbol = useMemo(() => {
    const hotSymbolSet = new Set(hotSymbols)
    const hotEntries = markets.filter((m) => hotSymbolSet.has(m.symbol))
    return new Map(hotEntries.map((m) => [m.symbol, m]))
  }, [hotSymbols, markets])

  const hotMarkets = useMemo(
    () =>
      hotSymbols
        .map((symbol) => bySymbol.get(symbol))
        .filter((m): m is Market => m !== undefined),
    [hotSymbols, bySymbol],
  )

  const marqueeDurationSec = Math.max(
    hotMarkets.length * SECONDS_PER_ITEM,
    MIN_MARQUEE_DURATION_SEC,
  )

  const activeSymbol = useMemo<MarketSymbol | null>(() => {
    const raw = searchParams.get(MARKET_QUERY_PARAM)
    if (raw === null) return null
    return parseMarketParam(raw)?.coin ?? null
  }, [searchParams])

  const onSelect = useCallback(
    (symbol: MarketSymbol) => {
      navigate(buildTradeMarketHref(symbol))
    },
    [navigate],
  )

  return { isLoading, hotMarkets, activeSymbol, marqueeDurationSec, onSelect }
}
