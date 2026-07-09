import { useState } from 'react'
import { useChart } from './use-chart'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { DEFAULT_TIMEFRAME } from './chart.constants'
import { priceDecimals, specFromMarket } from '@/modules/shared/utils/format-price'
import type { Interval } from '../../../shared/domain/domain.types'
import type { UseChartViewReturn } from './chart.types'

export function useChartView(): UseChartViewReturn {
  const { selectedMarket, market } = useSelectedMarketContext()
  const [interval, setInterval] = useState<Interval>(DEFAULT_TIMEFRAME)

  // The HL coin name is the candle subscription key (plan 03-03). Fall back to
  // the routable symbol for legacy mock-venue markets that carry no hlCoin.
  const symbol = market.hlCoin ?? selectedMarket
  // Absent hasCandles (legacy mock-venue markets) is treated as "has candles".
  const hasCandles = market.hasCandles !== false

  // Fixed per-asset precision (from the live mark price) so the axis, crosshair
  // label, and OHLC header all read the same number of decimals.
  const decimals = priceDecimals(market.markPrice ?? 0, specFromMarket(market))

  const chart = useChart({ symbol, interval, hasCandles, priceDecimals: decimals })

  return {
    interval,
    setInterval,
    containerRef: chart.containerRef,
    loading: chart.loading,
    hasCandleData: chart.hasCandleData,
    error: chart.error,
    noCandles: chart.noCandles,
    retry: chart.retry,
    crosshairOhlc: chart.crosshairOhlc,
    liveBadge: chart.liveBadge,
    priceDecimals: decimals,
  }
}
