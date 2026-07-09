import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ok, err, okAsync } from 'neverthrow'

const mocks = vi.hoisted(() => {
  const candleSeries = { setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn() }
  const volumeSeries = { setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn() }
  const HistogramSeries = { type: 'Histogram' } as const
  const CandlestickSeries = { type: 'Candlestick' } as const

  const mockCreateChart = vi.fn(() => ({
    addSeries: (def: unknown) => (def === HistogramSeries ? volumeSeries : candleSeries),
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({
      resetTimeScale: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    }),
    priceScale: () => ({ applyOptions: vi.fn() }),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
  }))

  const mockGetCandleHistory = vi.fn<(symbol: string, interval: string, count?: number) => unknown>()
  const mockSubscribeCandles = vi.fn<(symbol: string, interval: string, onUpdate: (u: unknown) => void) => () => void>(
    () => () => {},
  )

  return { mockCreateChart, mockGetCandleHistory, mockSubscribeCandles, CandlestickSeries, HistogramSeries }
})

vi.mock('lightweight-charts', () => ({
  createChart: mocks.mockCreateChart,
  CandlestickSeries: mocks.CandlestickSeries,
  HistogramSeries: mocks.HistogramSeries,
  CrosshairMode: { Normal: 0, Magnet: 1, Hidden: 2 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  ColorType: { Solid: 'solid' },
}))

import { ThemeProvider } from '../../../../shared/providers/theme-provider'
import { SelectedMarketProvider } from '../../../providers/selected-market-provider'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { Chart } from '../Chart'
import type { Venue, CandlesReader } from '../../../../shared/domain'

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

function Wrap({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <VenueContext.Provider value={stubVenue}>
        <ThemeProvider>
          <SelectedMarketProvider>{children}</SelectedMarketProvider>
        </ThemeProvider>
      </VenueContext.Provider>
    </MemoryRouter>
  )
}

describe('Chart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetCandleHistory.mockReturnValue(
      ok([
        {
          symbol: 'BTC-PERP',
          interval: '1m',
          openTime: 1_000_000,
          open: 100,
          high: 102,
          low: 99,
          close: 101,
          volume: 50,
        },
      ]),
    )
  })

  it('renders the timeframe dropdown defaulting to 1 min', () => {
    render(<Wrap><Chart /></Wrap>)
    const trigger = screen.getByRole('button', { name: 'Timeframe' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveTextContent('1 min')
  })

  it('lists every timeframe — including the new 1 week and 1 month — when opened', () => {
    render(<Wrap><Chart /></Wrap>)
    fireEvent.click(screen.getByRole('button', { name: 'Timeframe' }))
    for (const label of ['1 min', '5 min', '15 min', '1 hour', '4 hours', '1 day', '1 week', '1 month']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('option', { name: '1 min' }).getAttribute('aria-selected')).toBe('true')
  })

  it('changes the active timeframe when a different option is selected', () => {
    render(<Wrap><Chart /></Wrap>)
    fireEvent.click(screen.getByRole('button', { name: 'Timeframe' }))
    fireEvent.click(screen.getByRole('option', { name: '5 min' }))
    expect(screen.getByRole('button', { name: 'Timeframe' })).toHaveTextContent('5 min')
  })

  it('renders the OHLCV strip', () => {
    render(<Wrap><Chart /></Wrap>)
    expect(screen.getByLabelText('OHLCV')).toBeInTheDocument()
  })

  it('renders the error tile with retry when getCandleHistory fails', async () => {
    const errResult = err(Object.assign(new Error('boom'), { kind: 'invalid-symbol' }))
    mocks.mockGetCandleHistory.mockReturnValue(errResult)
    render(<Wrap><Chart /></Wrap>)
    await waitFor(() => {
      expect(screen.getByText('CHART UNAVAILABLE')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
