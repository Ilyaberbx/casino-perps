import { useEffect, useMemo, useState } from 'react'
import { useChart } from './use-chart'
import { useSelectedMarketContext } from '../../providers/selected-market-provider'
import { DEFAULT_TIMEFRAME } from './chart.constants'
import { buildPositionPriceLines, resolveChartColors } from './chart.utils'
import { priceDecimals, specFromMarket } from '@/modules/shared/utils/format-price'
import { useOwnCapability } from '../../../shared/providers/venue-provider'
import { useThemeContext } from '../../../shared/providers/theme-provider'
import type { PerpPositionSnapshot } from '../../../shared/domain'
import type { Interval } from '../../../shared/domain/domain.types'
import type { UseChartViewReturn } from './chart.types'

export function useChartView(): UseChartViewReturn {
  const { selectedMarket, market } = useSelectedMarketContext()
  const [interval, setInterval] = useState<Interval>(DEFAULT_TIMEFRAME)
  const { theme } = useThemeContext()

  // The HL coin name is the candle subscription key (plan 03-03). Fall back to
  // the routable symbol for legacy mock-venue markets that carry no hlCoin.
  const symbol = market.hlCoin ?? selectedMarket
  // Absent hasCandles (legacy mock-venue markets) is treated as "has candles".
  const hasCandles = market.hasCandles !== false

  // Fixed per-asset precision (from the live mark price) so the axis, crosshair
  // label, and OHLC header all read the same number of decimals.
  const decimals = priceDecimals(market.markPrice ?? 0, specFromMarket(market))

  // Entry + liquidation lines for YOUR open position on this market (acting-keyed,
  // so they stay your own while spectating). A liquidation price is only really
  // legible against the price axis: a number in a panel tells you where it is, a
  // line tells you how close you are to it.
  const positionsCap = useOwnCapability('perpsPositionsSnapshot')
  const [positions, setPositions] = useState<ReadonlyArray<PerpPositionSnapshot>>([])
  useEffect(() => {
    if (!positionsCap) return
    return positionsCap.subscribe((next) => setPositions(next))
  }, [positionsCap])

  const priceLines = useMemo(() => {
    const position = positions.find((entry) => entry.symbol === selectedMarket) ?? null
    return buildPositionPriceLines(position, resolveChartColors(theme))
  }, [positions, selectedMarket, theme])

  const chart = useChart({
    symbol,
    interval,
    hasCandles,
    priceDecimals: decimals,
    priceLines,
  })

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
