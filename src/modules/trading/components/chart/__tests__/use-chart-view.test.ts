import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ok, okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { createElement, useEffect } from 'react'

// RED scaffold (plan 03-01 Task 1; turns green in plan 03-04).
// WIRE-02 / D-01: when the selected market has hasCandles === false the chart
// must NEVER call the candles capability (no getHistory, no subscribe) and
// must expose a no-candle flag on the hook return. Fails today: useChartView
// receives only a symbol string, useChart unconditionally fetches candles, and
// UseChartViewReturn has no no-candle flag.

const mocks = vi.hoisted(() => ({
  mockGetCandleHistory: vi.fn<(s: string, i: string, c?: number) => unknown>(),
  mockSubscribeCandles: vi.fn<(s: string, i: string, cb: (u: unknown) => void) => () => void>(),
  mockCreateChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({ setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn() })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  })),
}))

vi.mock('lightweight-charts', () => ({
  createChart: mocks.mockCreateChart,
  CandlestickSeries: { type: 'Candlestick' },
  HistogramSeries: { type: 'Histogram' },
  CrosshairMode: { Normal: 0, Magnet: 1, Hidden: 2 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  ColorType: { Solid: 'solid' },
}))

import { ThemeProvider } from '../../../../shared/providers/theme-provider'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { useChartView } from '../use-chart-view'
import type { Venue, CandlesReader, Market } from '../../../../shared/domain'
import type { UseSelectedMarketProviderReturn } from '../../../providers/selected-market-provider/selected-market-provider.types'

const stubVenue: Venue = {
  metadata: { id: 'mock', label: 'Mock' },
  capabilities: {
    connection: { status: () => 'connected', subscribe: () => () => {} },
    candles: {
      getHistory: (symbol, interval, count) =>
        mocks.mockGetCandleHistory(symbol, interval, count) as ReturnType<CandlesReader['getHistory']>,
      loadOlder: () => okAsync({ candles: [], reachedStart: true }),
      subscribe: (symbol, interval, cb) =>
        mocks.mockSubscribeCandles(symbol, interval, cb as (u: unknown) => void),
    },
  },
}

const NO_CANDLE_MARKET: Market = {
  symbol: 'xyz:AAPL',
  baseAsset: 'AAPL',
  quoteAsset: 'USDC',
  venue: 'hyperliquid:mainnet',
  tickSize: 0.01,
  stepSize: 0.01,
  marketType: 'hip3',
  hlCoin: 'xyz:AAPL',
  hasCandles: false,
}

// The provider value the RED test expects the provider to expose: in addition
// to the symbol string, the resolved Market for the current symbol. This shape
// extension lands in plan 03-04 (provider widening). Until then the cast keeps
// the scaffold compiling while the runtime assertions stay RED.
function buildSelectedMarketValue(market: Market): UseSelectedMarketProviderReturn {
  return {
    selectedMarket: market.symbol,
    setSelectedMarket: () => {},
    market,
  } as unknown as UseSelectedMarketProviderReturn
}

function NoCandleProbe({ onNoCandles }: { onNoCandles: (flag: boolean) => void }) {
  const view = useChartView()
  // RED: `noCandles` does not exist on UseChartViewReturn yet (added 03-04).
  const flag = (view as unknown as { noCandles?: boolean }).noCandles ?? false
  useEffect(() => {
    onNoCandles(flag)
  }, [flag, onNoCandles])
  return createElement('div', { ref: view.containerRef })
}

function Wrap({ children, market }: { children: ReactNode; market: Market }) {
  return createElement(
    SelectedMarketContext.Provider,
    { value: buildSelectedMarketValue(market) },
    createElement(
      VenueContext.Provider,
      { value: stubVenue },
      createElement(ThemeProvider, null, children),
    ),
  )
}

describe('useChartView — hasCandles=false guard (RED 03-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetCandleHistory.mockReturnValue(ok([]))
    mocks.mockSubscribeCandles.mockImplementation(() => () => {})
  })

  it('WIRE-02: never calls the candles capability and exposes noCandles when hasCandles === false', () => {
    let observed = false
    render(
      createElement(Wrap, {
        market: NO_CANDLE_MARKET,
        children: createElement(NoCandleProbe, { onNoCandles: (f) => { observed = f } }),
      }),
    )

    expect(mocks.mockGetCandleHistory).not.toHaveBeenCalled()
    expect(mocks.mockSubscribeCandles).not.toHaveBeenCalled()
    expect(observed).toBe(true)
  })
})
