import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LogicalRange,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { CandleError } from '../../../shared/domain'
import type { Candle, CandleUpdate } from '../../../shared/domain/domain.types'
import { useThemeContext } from '../../../shared/providers/theme-provider'
import { useCapability } from '../../../shared/providers/venue-provider'
import { resolveChartColors, reconcileCandles, sortDedupeCandles } from './chart.utils'
import type { ChartColors, CrosshairOhlc, UseChartParams, UseChartReturn, LiveBadge } from './chart.types'

const HISTORY_COUNT = 500
const LOAD_OLDER_PAGE_COUNT = 500
// Hard ceiling on the in-memory candle buffer. Pan-back prepends a page at a
// time and re-feeds the whole array to lightweight-charts via setData, so an
// uncapped buffer turns into a multi-thousand-bar redraw on every further pan —
// a real FPS cliff on history-scrubbing sessions. 3000 is several pages beyond
// any visible window; once hit we stop fetching older bars (latch, never trim)
// so every loaded bar stays visible and the redraw cost is bounded.
const MAX_HISTORY_BARS = 3000
// Trigger pan-back when the leftmost visible bar is within this many bars of
// the start of currently loaded data. 50 ≈ enough buffer to fetch and merge
// before the user pans off the edge on a fast drag.
const PREFETCH_BUFFER_BARS = 50

function toCandleData(candle: Candle): CandlestickData {
  return {
    time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }
}

function toVolumeData(candle: Candle, colors: ChartColors): HistogramData {
  const isUp = candle.close >= candle.open
  return {
    time: Math.floor(candle.openTime / 1000) as UTCTimestamp,
    value: candle.volume,
    color: isUp ? colors.directionUp : colors.directionDown,
  }
}

function buildChartOptions(colors: ChartColors) {
  return {
    autoSize: true,
    // Directional touch gestures (mobile): disabling vertical touch-drag makes
    // lightweight-charts set the canvas `touch-action: pan-y`, so a vertical
    // swipe scrolls the PAGE (not the chart) while a horizontal drag still pans
    // the time axis and pinch still zooms. Fixes "can't scroll the page over the
    // chart on mobile." Touch-only — desktop mouse pan/zoom (mouseWheel +
    // pressedMouseMove) is unaffected.
    handleScroll: {
      vertTouchDrag: false,
    },
    layout: {
      background: { color: colors.surface },
      textColor: colors.text,
      fontFamily: colors.fontMono,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: colors.gridLine, style: 0 },
    },
    crosshair: { mode: CrosshairMode.Magnet },
    rightPriceScale: {
      borderColor: colors.border,
    },
    leftPriceScale: { visible: false },
    timeScale: {
      borderColor: colors.border,
      timeVisible: true,
      secondsVisible: false,
    },
    watermark: { visible: false },
  } as const
}

function buildPriceFormat(priceDecimals: number) {
  return {
    type: 'price' as const,
    precision: priceDecimals,
    minMove: 10 ** -priceDecimals,
  }
}

function buildCandleOptions(colors: ChartColors, priceDecimals: number) {
  return {
    upColor: colors.directionUp,
    downColor: colors.directionDown,
    wickUpColor: colors.directionUp,
    wickDownColor: colors.directionDown,
    borderUpColor: colors.directionUp,
    borderDownColor: colors.directionDown,
    priceLineStyle: LineStyle.Dashed,
    priceLineVisible: true,
    lastValueVisible: true,
    priceFormat: buildPriceFormat(priceDecimals),
  } as const
}

function buildVolumeOptions() {
  return {
    priceFormat: { type: 'volume' as const },
    priceScaleId: '',
  } as const
}

function ohlcFromCandle(candle: Candle): CrosshairOhlc {
  return {
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    time: candle.openTime,
  }
}

export function useChart({
  symbol,
  interval,
  hasCandles,
  priceDecimals,
  priceLines,
}: UseChartParams): UseChartReturn {
  const { theme } = useThemeContext()
  const candlesCap = useCapability('candles')

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setContainerEl(node)
  }, [])
  const chartRef = useRef<IChartApi | null>(null)
  const [chartReadyTick, setChartReadyTick] = useState(0)
  const candlesSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const historyRef = useRef<Candle[]>([])
  const lastCandleRef = useRef<Candle | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CandleError | null>(null)
  // Pure prop-derived terminal flag (D-01). Not React state: it depends only
  // on the resolved Market's hasCandles, never on an async candle fetch.
  const noCandles = !hasCandles
  const [retryCount, setRetryCount] = useState(0)
  const [crosshairOhlc, setCrosshairOhlc] = useState<CrosshairOhlc | null>(null)
  // One-shot presence flag (ADR-0043). Replaces a `latestCandle` state that
  // re-rendered the chart subtree on every candle tick for a `!== null` check.
  // The live candle lives in `lastCandleRef`; this only flips false→true once.
  const [hasCandleData, setHasCandleData] = useState(false)
  const hasCandleDataRef = useRef(false)
  const [liveBadge, setLiveBadge] = useState<LiveBadge>(null)

  const previousSymbolRef = useRef<string | null>(null)
  const previousIntervalRef = useRef<string | null>(null)

  // Create chart once when container is available
  useEffect(() => {
    const isContainerMissing = containerEl === null
    if (isContainerMissing) return
    const isAlreadyCreated = chartRef.current !== null
    if (isAlreadyCreated) return

    const colors = resolveChartColors(theme)
    const chart = createChart(containerEl, buildChartOptions(colors))
    const candleSeries = chart.addSeries(CandlestickSeries, buildCandleOptions(colors, priceDecimals))
    const volumeSeries = chart.addSeries(HistogramSeries, buildVolumeOptions(), 1)

    // Crosshair moves fire at pointer rate (~60–120Hz). Coalesce the resulting
    // setState to one per animation frame (ADR-0043) so dragging across the
    // chart doesn't re-render ChartHeader faster than it can paint.
    let crosshairFrame = 0
    let pendingCrosshair: CrosshairOhlc | null = null
    let hasPendingCrosshair = false
    const flushCrosshair = () => {
      crosshairFrame = 0
      if (!hasPendingCrosshair) return
      hasPendingCrosshair = false
      setCrosshairOhlc(pendingCrosshair)
    }
    chart.subscribeCrosshairMove((param: MouseEventParams<Time>) => {
      const isOutside = param.point === undefined || param.time === undefined
      if (isOutside) {
        const fallback = lastCandleRef.current
        pendingCrosshair = fallback === null ? null : ohlcFromCandle(fallback)
      } else {
        const targetTime = param.time
        const match = historyRef.current.find(
          (candle) => Math.floor(candle.openTime / 1000) === Number(targetTime),
        )
        const resolved = match ?? lastCandleRef.current
        pendingCrosshair = resolved === null ? null : ohlcFromCandle(resolved)
      }
      hasPendingCrosshair = true
      if (crosshairFrame === 0) crosshairFrame = requestAnimationFrame(flushCrosshair)
    })

    chartRef.current = chart
    candlesSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    setChartReadyTick((t) => t + 1)

    return () => {
      if (crosshairFrame !== 0) cancelAnimationFrame(crosshairFrame)
      chart.remove()
      chartRef.current = null
      candlesSeriesRef.current = null
      volumeSeriesRef.current = null
    }
    // theme is intentionally omitted: theme changes are handled by the
    // applyOptions effect below so we don't recreate the chart instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerEl])

  // Apply colors on theme change
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candlesSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const isReady = chart !== null && candleSeries !== null && volumeSeries !== null
    if (!isReady) return

    const colors = resolveChartColors(theme)
    chart.applyOptions(buildChartOptions(colors))
    candleSeries.applyOptions(buildCandleOptions(colors, priceDecimals))
    volumeSeries.applyOptions(buildVolumeOptions())

    // Recolor existing volume bars so they track the new theme
    const recolored = historyRef.current.map((c) => toVolumeData(c, colors))
    volumeSeries.setData(recolored)
    // priceDecimals is intentionally omitted: the dedicated effect below owns
    // re-applying priceFormat on a market switch so we don't recolor on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, chartReadyTick])

  // Re-apply price precision on market switch (axis + crosshair label).
  useEffect(() => {
    const candleSeries = candlesSeriesRef.current
    if (candleSeries === null) return
    candleSeries.applyOptions({ priceFormat: buildPriceFormat(priceDecimals) })
  }, [priceDecimals, chartReadyTick])

  // Reconcile the horizontal reference lines (entry / liquidation) against the
  // live series: create what is new, update what moved, remove what is gone.
  // Keyed by `id` and held in a ref (the `IPriceLine` handles are imperative
  // chart objects, never React state). Reruns on `chartReadyTick` so a series
  // rebuild — which happens on market switch and drops its own price lines —
  // re-draws them, and the stale handles are dropped rather than reused.
  const priceLineHandlesRef = useRef<Map<string, IPriceLine>>(new Map())
  useEffect(() => {
    const candleSeries = candlesSeriesRef.current
    const handles = priceLineHandlesRef.current
    if (candleSeries === null) {
      handles.clear()
      return
    }
    const next = priceLines ?? []
    const wanted = new Set(next.map((line) => line.id))

    for (const [id, handle] of handles) {
      if (wanted.has(id)) continue
      candleSeries.removePriceLine(handle)
      handles.delete(id)
    }

    for (const line of next) {
      const options = {
        price: line.price,
        color: line.color,
        title: line.title,
        lineWidth: 1 as const,
        lineStyle: line.style === 'dashed' ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
      }
      const existing = handles.get(line.id)
      if (existing) {
        existing.applyOptions(options)
        continue
      }
      handles.set(line.id, candleSeries.createPriceLine(options))
    }
  }, [priceLines, chartReadyTick])

  // Keep a ref so the subscription callback can read the current theme without
  // being in the subscribe effect's deps (which would re-subscribe on every toggle).
  const themeRef = useRef(theme)
  useEffect(() => { themeRef.current = theme })   // no deps — syncs after every render

  // D-01 / WIRE-02: guard BEFORE any candles capability call. When the
  // resolved Market has no candle feed (hasCandles === false) the candle
  // subscription is NEVER attempted — the no-candle state is reached by this
  // guard (and the pure `noCandles` flag above), never by catching an
  // empty/failed fetch. Clearing the residual loading/error/live state is
  // deferred via queueMicrotask (mirrors the subscribe effect below) so no
  // setState fires synchronously inside the effect body.
  useEffect(() => {
    if (hasCandles) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(false)
      setError(null)
      setLiveBadge(null)
    })
    return () => {
      cancelled = true
    }
  }, [hasCandles, symbol])

  // Load history + subscribe on symbol/interval/retry change
  useEffect(() => {
    // Guard: never touch the candles capability for a no-candle market.
    if (!hasCandles) return
    // Bug A: skip when symbol unresolved (market cache not loaded yet).
    // Forwarding `coin: ""` to HL would close the shared WebSocketTransport.
    if (symbol === '') return

    const chart = chartRef.current
    const candleSeries = candlesSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const isReady = chart !== null && candleSeries !== null && volumeSeries !== null
    if (!isReady) return

    const previousSymbol = previousSymbolRef.current
    const previousInterval = previousIntervalRef.current
    const isFirstLoad = previousSymbol === null
    const isSymbolChange = !isFirstLoad && previousSymbol !== symbol
    const isIntervalChange = !isFirstLoad && previousInterval !== interval

    const result = candlesCap.getHistory(symbol, interval, HISTORY_COUNT)
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      setLiveBadge(null)
      if (result.isErr()) {
        setError(result.error)
        setLoading(false)
        return
      }
      setError(null)
      setLoading(false)
      const history = sortDedupeCandles(result.value)
      const newest = history[history.length - 1] ?? null
      if (newest !== null && !hasCandleDataRef.current) {
        hasCandleDataRef.current = true
        setHasCandleData(true)
      }
      setCrosshairOhlc(newest === null ? null : ohlcFromCandle(newest))
    })

    if (result.isOk()) {
      // Defensive: an unsorted venue response would trip lightweight-charts'
      // ascending-order assertion on this setData (and every later one). Sort +
      // dedupe before the ref assignment so the whole buffer is monotonic.
      const history = sortDedupeCandles(result.value)
      historyRef.current = history
      const initialColors = resolveChartColors(themeRef.current)
      candleSeries.setData(history.map(toCandleData))
      volumeSeries.setData(history.map((c) => toVolumeData(c, initialColors)))

      const newest = history[history.length - 1] ?? null
      lastCandleRef.current = newest

      // Reset the time scale to its default zoom (default bar spacing, scrolled
      // to the real-time edge) on first load and on every market switch — not
      // fitContent, which crams all ~500 loaded candles into the width. A bare
      // interval change keeps the user's current zoom.
      const shouldResetZoom = isFirstLoad || isSymbolChange
      if (shouldResetZoom && !isIntervalChange) {
        chart.timeScale().resetTimeScale()
      }
      // Re-enable price auto-scaling on a market switch / first load. Dragging
      // the price axis disables `autoScale` in lightweight-charts; without this
      // the new market's candles render against the *previous* market's frozen
      // price range and fall off-screen (e.g. switching to ETH ~1.6k while the
      // scale is stuck on BTC ~62k). Symbol change always needs a price re-fit,
      // even when the interval changed in the same render — hence no
      // `!isIntervalChange` guard here. A bare interval change deliberately
      // preserves the user's current zoom + autoScale state. NOT set in
      // buildChartOptions: that runs on every theme toggle and would wrongly
      // override a user's manual price zoom.
      if (shouldResetZoom) {
        chart.priceScale('right').applyOptions({ autoScale: true })
      }

      previousSymbolRef.current = symbol
      previousIntervalRef.current = interval

      unsubscribe = candlesCap.subscribe(symbol, interval, (update: CandleUpdate) => {
        // Resync (ADR-0041): a full-window snapshot replaces the series in one
        // bulk setData — the chart jumps straight to the current tick instead of
        // animating through a buffered backlog at "10× speed". Fired at initial
        // subscribe and on every reconnect.
        if (update.kind === 'snapshot') {
          const colors = resolveChartColors(themeRef.current)
          historyRef.current = update.candles
          candleSeries.setData(update.candles.map(toCandleData))
          volumeSeries.setData(update.candles.map((c) => toVolumeData(c, colors)))
          const newest = update.candles[update.candles.length - 1] ?? null
          lastCandleRef.current = newest
          if (newest !== null && !hasCandleDataRef.current) {
            hasCandleDataRef.current = true
            setHasCandleData(true)
          }
          return
        }
        const reconciliation = reconcileCandles(historyRef.current, update.candle)
        if (!reconciliation.accepted) return
        const candle = update.candle
        historyRef.current = reconciliation.history
        lastCandleRef.current = candle
        candleSeries.update(toCandleData(candle))
        volumeSeries.update(toVolumeData(candle, resolveChartColors(themeRef.current)))
        // One-shot only: after the first candle this never re-renders again. The
        // canvas was already updated imperatively via series.update() above.
        if (!hasCandleDataRef.current) {
          hasCandleDataRef.current = true
          setHasCandleData(true)
        }
      })
    }

    return () => {
      cancelled = true
      if (unsubscribe !== null) unsubscribe()
    }
    // theme is intentionally omitted: theme changes are handled by the recolor
    // effect above (lines 172-188) and must never re-run the data subscription.
  }, [symbol, interval, retryCount, chartReadyTick, candlesCap, hasCandles])

  // Pan-back: load older candles when the user scrolls/zooms near the start
  // of loaded data. One in-flight fetch per (symbol, interval); reachedStart
  // latches once HL returns a short page (no more history exists).
  useEffect(() => {
    const chart = chartRef.current
    const candleSeries = candlesSeriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const isReady = chart !== null && candleSeries !== null && volumeSeries !== null
    if (!isReady) return
    if (!hasCandles) return

    let inFlight = false
    let reachedStart = false
    let cancelled = false

    const handler = (range: LogicalRange | null) => {
      if (range === null) return
      if (inFlight || reachedStart) return
      const history = historyRef.current
      if (history.length === 0) return
      if (range.from > PREFETCH_BUFFER_BARS) return

      // Bound the buffer + the setData redraw: once we've loaded the ceiling of
      // bars, stop fetching older history. Latches like the reachedStart case
      // below — no already-loaded bar is removed, so the visible window and the
      // crosshair lookup are unaffected.
      const isAtHistoryCeiling = history.length >= MAX_HISTORY_BARS
      if (isAtHistoryCeiling) {
        reachedStart = true
        return
      }

      const oldest = history[0]
      inFlight = true
      void candlesCap
        .loadOlder(symbol, interval, oldest.openTime, LOAD_OLDER_PAGE_COUNT)
        .match(
          (result) => {
            if (cancelled) return
            if (result.reachedStart) reachedStart = true
            if (result.candles.length === 0) {
              inFlight = false
              return
            }
            const colors = resolveChartColors(themeRef.current)
            // Sort + dedupe the prepended page into the loaded history BEFORE the
            // ref assignment and any setData. An overlapping or out-of-order page
            // would otherwise leave the buffer non-monotonic, and the next setData
            // on it — including the theme recolor — trips lightweight-charts'
            // ascending-order assertion (STAB-02).
            const merged = sortDedupeCandles([...result.candles, ...historyRef.current])
            historyRef.current = merged
            candleSeries.setData(merged.map(toCandleData))
            volumeSeries.setData(merged.map((c) => toVolumeData(c, colors)))
            inFlight = false
          },
          () => {
            if (cancelled) return
            // Non-fatal: pan-back failure leaves the chart at the current
            // edge; next pan retries naturally. Reader already logged the
            // underlying gateway error.
            inFlight = false
          },
        )
    }

    const timeScale = chart.timeScale()
    timeScale.subscribeVisibleLogicalRangeChange(handler)
    return () => {
      cancelled = true
      timeScale.unsubscribeVisibleLogicalRangeChange(handler)
    }
  }, [symbol, interval, chartReadyTick, hasCandles, candlesCap])

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1)
  }, [])

  return {
    containerRef,
    loading,
    error,
    noCandles,
    retry,
    crosshairOhlc,
    hasCandleData,
    liveBadge,
  }
}
