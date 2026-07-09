import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { ok, err, okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement, useEffect } from 'react'

const mocks = vi.hoisted(() => {
  const mockCandlestickSetData = vi.fn()
  const mockCandlestickUpdate = vi.fn()
  const mockCandlestickApplyOptions = vi.fn()

  const mockHistogramSetData = vi.fn()
  const mockHistogramUpdate = vi.fn()
  const mockHistogramApplyOptions = vi.fn()

  const mockApplyOptions = vi.fn()
  const mockRemove = vi.fn()
  const mockResetTimeScale = vi.fn()
  const mockPriceScaleApplyOptions = vi.fn()
  const mockSubscribeVisibleLogicalRangeChange = vi.fn()
  const mockUnsubscribeVisibleLogicalRangeChange = vi.fn()
  const mockLoadOlder = vi.fn()

  const candleSeries = {
    setData: mockCandlestickSetData,
    update: mockCandlestickUpdate,
    applyOptions: mockCandlestickApplyOptions,
  }
  const volumeSeries = {
    setData: mockHistogramSetData,
    update: mockHistogramUpdate,
    applyOptions: mockHistogramApplyOptions,
  }

  const CandlestickSeries = { type: 'Candlestick' } as const
  const HistogramSeries = { type: 'Histogram' } as const

  const mockAddSeries = vi.fn((definition: unknown) => {
    return definition === HistogramSeries ? volumeSeries : candleSeries
  })
  const mockSubscribeCrosshairMove = vi.fn()
  const mockUnsubscribeCrosshairMove = vi.fn()

  const mockCreateChart = vi.fn(() => ({
    addSeries: mockAddSeries,
    applyOptions: mockApplyOptions,
    remove: mockRemove,
    timeScale: () => ({
      resetTimeScale: mockResetTimeScale,
      subscribeVisibleLogicalRangeChange: mockSubscribeVisibleLogicalRangeChange,
      unsubscribeVisibleLogicalRangeChange: mockUnsubscribeVisibleLogicalRangeChange,
    }),
    priceScale: () => ({
      applyOptions: mockPriceScaleApplyOptions,
    }),
    subscribeCrosshairMove: mockSubscribeCrosshairMove,
    unsubscribeCrosshairMove: mockUnsubscribeCrosshairMove,
  }))

  const mockGetCandleHistory =
    vi.fn<(symbol: string, interval: string, count?: number) => unknown>()
  const mockSubscribeCandles =
    vi.fn<(s: string, i: string, cb: (u: unknown) => void) => () => void>()
  const mockUnsubscribeCandles = vi.fn()

  return {
    mockCandlestickSetData,
    mockCandlestickUpdate,
    mockCandlestickApplyOptions,
    mockHistogramSetData,
    mockHistogramUpdate,
    mockHistogramApplyOptions,
    mockApplyOptions,
    mockRemove,
    mockResetTimeScale,
    mockPriceScaleApplyOptions,
    mockSubscribeVisibleLogicalRangeChange,
    mockUnsubscribeVisibleLogicalRangeChange,
    mockLoadOlder,
    mockAddSeries,
    mockSubscribeCrosshairMove,
    mockUnsubscribeCrosshairMove,
    mockCreateChart,
    mockGetCandleHistory,
    mockSubscribeCandles,
    mockUnsubscribeCandles,
    CandlestickSeries,
    HistogramSeries,
  }
})

vi.mock('lightweight-charts', () => ({
  createChart: mocks.mockCreateChart,
  CandlestickSeries: mocks.CandlestickSeries,
  HistogramSeries: mocks.HistogramSeries,
  CrosshairMode: { Normal: 0, Magnet: 1, Hidden: 2 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  ColorType: { Solid: 'solid' },
}))

import { ThemeProvider, useThemeContext } from '../../../../shared/providers/theme-provider'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { useChart } from '../use-chart'
import type { Candle } from '../../../../shared/domain/domain.types'
import type { Venue, CandlesReader, CandleUpdate } from '../../../../shared/domain'
import type { ThemeAndChartProps } from '../__fixtures__/use-chart.types'

const stubVenue: Venue = {
  metadata: { id: 'mock', label: 'Mock' },
  capabilities: {
    connection: { status: () => 'connected', subscribe: () => () => {} },
    candles: {
      getHistory: (symbol, interval, count) =>
        mocks.mockGetCandleHistory(symbol, interval, count) as ReturnType<CandlesReader['getHistory']>,
      loadOlder: (symbol, interval, before, count) =>
        mocks.mockLoadOlder(symbol, interval, before, count) as ReturnType<CandlesReader['loadOlder']>,
      subscribe: (symbol, interval, cb) =>
        mocks.mockSubscribeCandles(symbol, interval, cb as (u: unknown) => void),
    },
  },
}

function buildCandle(openTime: number, close: number): Candle {
  return {
    symbol: 'BTC-PERP',
    interval: '1m',
    openTime,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 100,
  }
}

const SAMPLE_HISTORY: Candle[] = [
  buildCandle(1_000_000, 100),
  buildCandle(1_060_000, 101),
]

function ChartProbe({ symbol, interval }: { symbol: string; interval: '1m' | '5m' | '15m' }) {
  const hook = useChart({ symbol, interval, hasCandles: true, priceDecimals: 2 })
  return createElement('div', { ref: hook.containerRef, 'data-testid': 'chart-container' })
}

function ErrorProbe({ onError }: { onError: (e: unknown) => void }) {
  const hook = useChart({ symbol: 'BAD', interval: '1m', hasCandles: true, priceDecimals: 2 })
  useEffect(() => { onError(hook.error) }, [hook.error, onError])
  return createElement('div', { ref: hook.containerRef })
}

function ThemeAndChart({ onToggle }: ThemeAndChartProps) {
  const ctx = useThemeContext()
  useEffect(() => { onToggle(ctx.toggleTheme) }, [ctx.toggleTheme, onToggle])
  return createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })
}

function Wrap({ children }: { children: ReactNode }) {
  return createElement(
    VenueContext.Provider,
    { value: stubVenue },
    createElement(ThemeProvider, null, children),
  )
}

describe('useChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetCandleHistory.mockReturnValue(ok(SAMPLE_HISTORY))
    mocks.mockSubscribeCandles.mockImplementation(() => mocks.mockUnsubscribeCandles)
    mocks.mockLoadOlder.mockReturnValue(okAsync({ candles: [], reachedStart: true }))
  })

  it('createChart, addSeries(Candlestick), addSeries(Histogram, paneIndex=1), and setData run on mount', () => {
    render(createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })))

    expect(mocks.mockCreateChart).toHaveBeenCalledTimes(1)
    expect(mocks.mockCreateChart).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({ autoSize: true }),
    )
    expect(mocks.mockAddSeries).toHaveBeenCalledWith(mocks.CandlestickSeries, expect.any(Object))
    expect(mocks.mockAddSeries).toHaveBeenCalledWith(mocks.HistogramSeries, expect.any(Object), 1)
    expect(mocks.mockCandlestickSetData).toHaveBeenCalled()
    expect(mocks.mockHistogramSetData).toHaveBeenCalled()
    expect(mocks.mockSubscribeCandles).toHaveBeenCalledWith(
      'BTC-PERP',
      '1m',
      expect.any(Function),
    )
  })

  it('pan-back fetches older candles when scrolled near the start of loaded data', () => {
    render(createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })))

    const rangeHandler = mocks.mockSubscribeVisibleLogicalRangeChange.mock.calls[0]?.[0] as
      | ((range: { from: number; to: number } | null) => void)
      | undefined
    expect(rangeHandler).toBeDefined()

    // from <= PREFETCH_BUFFER_BARS (50) with a small loaded buffer → loadOlder runs.
    rangeHandler?.({ from: 10, to: 200 })
    expect(mocks.mockLoadOlder).toHaveBeenCalledTimes(1)
  })

  it('stops fetching older candles once the buffer hits MAX_HISTORY_BARS (FPS ceiling)', () => {
    // Seed a buffer already at/over the 3000-bar ceiling. Pan-back must latch and
    // skip loadOlder so the setData redraw cost stays bounded on history scrubbing.
    const ceilingHistory = Array.from({ length: 3000 }, (_, index) =>
      buildCandle(1_000_000 + index * 60_000, 100 + index),
    )
    mocks.mockGetCandleHistory.mockReturnValue(ok(ceilingHistory))

    render(createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })))

    const rangeHandler = mocks.mockSubscribeVisibleLogicalRangeChange.mock.calls[0]?.[0] as
      | ((range: { from: number; to: number } | null) => void)
      | undefined
    expect(rangeHandler).toBeDefined()

    // Same near-start range that would normally trigger a fetch — but the ceiling
    // latch must short-circuit before loadOlder is ever called.
    rangeHandler?.({ from: 10, to: 200 })
    expect(mocks.mockLoadOlder).not.toHaveBeenCalled()
  })

  it('resets the time scale to default zoom on symbol change but not on interval change', () => {
    const { rerender } = render(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })),
    )
    mocks.mockResetTimeScale.mockClear()

    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '1m' })),
    )
    expect(mocks.mockResetTimeScale).toHaveBeenCalledTimes(1)

    mocks.mockResetTimeScale.mockClear()
    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '5m' })),
    )
    expect(mocks.mockResetTimeScale).not.toHaveBeenCalled()
  })

  it('re-enables price autoScale on a market switch but not on a bare interval change', () => {
    // Regression: lightweight-charts disables autoScale when the user drags the
    // price axis; without re-enabling it on switch, the new market's candles
    // render against the previous market's frozen range and fall off-screen
    // (the BTC ~62k scale stuck while viewing ETH ~1.6k bug).
    const { rerender } = render(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })),
    )
    mocks.mockPriceScaleApplyOptions.mockClear()

    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '1m' })),
    )
    expect(mocks.mockPriceScaleApplyOptions).toHaveBeenCalledWith({ autoScale: true })
    expect(mocks.mockPriceScaleApplyOptions).toHaveBeenCalledTimes(1)

    // A bare interval change preserves the user's current zoom + autoScale state.
    mocks.mockPriceScaleApplyOptions.mockClear()
    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '5m' })),
    )
    expect(mocks.mockPriceScaleApplyOptions).not.toHaveBeenCalled()
  })

  it('calls setData on both symbol and interval changes', () => {
    const { rerender } = render(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })),
    )
    mocks.mockCandlestickSetData.mockClear()

    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '1m' })),
    )
    expect(mocks.mockCandlestickSetData).toHaveBeenCalledTimes(1)

    rerender(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'ETH-PERP', interval: '5m' })),
    )
    expect(mocks.mockCandlestickSetData).toHaveBeenCalledTimes(2)
  })

  it('applies options on chart and series when theme changes', () => {
    let toggle: (() => void) | null = null
    render(
      createElement(Wrap, null, createElement(ThemeAndChart, {
        onToggle: (t) => { toggle = t },
      })),
    )

    mocks.mockApplyOptions.mockClear()
    mocks.mockCandlestickApplyOptions.mockClear()
    mocks.mockHistogramApplyOptions.mockClear()

    act(() => { toggle?.() })

    expect(mocks.mockApplyOptions).toHaveBeenCalled()
    expect(mocks.mockCandlestickApplyOptions).toHaveBeenCalled()
    expect(mocks.mockHistogramApplyOptions).toHaveBeenCalled()
  })

  it('switching theme multiple times does not call candlestick setData after initial load', () => {
    let toggle: (() => void) | null = null
    render(
      createElement(Wrap, null, createElement(ThemeAndChart, {
        onToggle: (t) => { toggle = t },
      })),
    )

    mocks.mockCandlestickSetData.mockClear()  // clear initial mount call

    // Toggle 5 times — none should re-trigger data subscription
    for (let i = 0; i < 5; i++) {
      act(() => { toggle?.() })
    }

    expect(mocks.mockCandlestickSetData).not.toHaveBeenCalled()
    // Recolor effect fires on each toggle: applyOptions + histogram setData
    expect(mocks.mockApplyOptions).toHaveBeenCalled()
    expect(mocks.mockHistogramSetData).toHaveBeenCalled()
  })

  it('returns an error when getCandleHistory fails', async () => {
    mocks.mockGetCandleHistory.mockReturnValueOnce(
      err(Object.assign(new Error('boom'), { kind: 'invalid-symbol' })),
    )
    let lastError: unknown = undefined
    await act(async () => {
      render(
        createElement(Wrap, null, createElement(ErrorProbe, {
          onError: (e) => { lastError = e },
        })),
      )
      await Promise.resolve()
    })

    expect(lastError).not.toBeNull()
    expect(lastError).toBeDefined()
  })

  it('STAB-01: drops an out-of-order (older) live candle so the buffer stays ascending', () => {
    let captured: ((u: { kind: 'new' | 'update'; candle: Candle }) => void) | null = null
    mocks.mockSubscribeCandles.mockImplementation((_s, _i, cb) => {
      captured = cb as typeof captured
      return mocks.mockUnsubscribeCandles
    })

    render(createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })))
    mocks.mockCandlestickUpdate.mockClear()

    // Newer bar, then a stale (older-openTime) bar — the classic
    // backfill-replay-after-live race that made historyRef non-monotonic.
    act(() => { captured?.({ kind: 'new', candle: buildCandle(2_000_000, 110) }) })
    act(() => { captured?.({ kind: 'new', candle: buildCandle(1_500_000, 105) }) })

    // Only the newer candle reaches the series; the stale one is dropped,
    // so lightweight-charts never receives descending data (no crash).
    expect(mocks.mockCandlestickUpdate).toHaveBeenCalledTimes(1)
    expect(mocks.mockCandlestickUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ time: Math.floor(2_000_000 / 1000) }),
    )
  })

  it('ADR-0041: a snapshot update bulk-replaces the series via setData (no per-candle replay)', () => {
    let captured: ((u: CandleUpdate) => void) | null = null
    mocks.mockSubscribeCandles.mockImplementation((_s, _i, cb) => {
      captured = cb as typeof captured
      return mocks.mockUnsubscribeCandles
    })

    render(createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })))
    mocks.mockCandlestickSetData.mockClear()
    mocks.mockCandlestickUpdate.mockClear()

    const candles = [buildCandle(3_000_000, 120), buildCandle(3_060_000, 121)]
    act(() => { captured?.({ kind: 'snapshot', candles }) })

    // One bulk setData jumps straight to current — no animated `.update()` per
    // buffered candle (the "10× replay" the snapshot path exists to kill).
    expect(mocks.mockCandlestickSetData).toHaveBeenCalledTimes(1)
    expect(mocks.mockCandlestickSetData).toHaveBeenCalledWith([
      expect.objectContaining({ time: Math.floor(3_000_000 / 1000) }),
      expect.objectContaining({ time: Math.floor(3_060_000 / 1000) }),
    ])
    expect(mocks.mockCandlestickUpdate).not.toHaveBeenCalled()
  })

  it('cleans up subscriptions and chart on unmount', () => {
    const { unmount } = render(
      createElement(Wrap, null, createElement(ChartProbe, { symbol: 'BTC-PERP', interval: '1m' })),
    )

    unmount()
    expect(mocks.mockUnsubscribeCandles).toHaveBeenCalled()
    expect(mocks.mockRemove).toHaveBeenCalled()
  })

  it('D-01: hasCandles=false never calls the candles capability and exposes noCandles', async () => {
    let observedNoCandles = false
    let observedLoading = true
    let observedError: unknown = 'unset'
    function NoCandleProbe() {
      const hook = useChart({ symbol: 'xyz:AAPL', interval: '1m', hasCandles: false, priceDecimals: 2 })
      useEffect(() => {
        observedNoCandles = hook.noCandles
        observedLoading = hook.loading
        observedError = hook.error
      }, [hook.noCandles, hook.loading, hook.error])
      return createElement('div', { ref: hook.containerRef })
    }

    render(createElement(Wrap, null, createElement(NoCandleProbe, null)))

    expect(mocks.mockGetCandleHistory).not.toHaveBeenCalled()
    expect(mocks.mockSubscribeCandles).not.toHaveBeenCalled()
    expect(observedNoCandles).toBe(true)

    // loading/error are cleared via queueMicrotask (mirrors the subscribe
    // effect) — flush microtasks before asserting the residual state.
    await waitFor(() => {
      expect(observedLoading).toBe(false)
    })
    expect(observedError).toBeNull()
    expect(mocks.mockGetCandleHistory).not.toHaveBeenCalled()
    expect(mocks.mockSubscribeCandles).not.toHaveBeenCalled()
  })
})
