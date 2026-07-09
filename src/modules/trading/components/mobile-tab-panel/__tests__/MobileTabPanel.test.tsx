import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { UseMobileTabPanelReturn } from '../mobile-tab-panel.types'

// Mock the heavy stream panels so the test asserts mount/unmount purely from the
// tree, without opening real venue subscriptions. LazyChart is mounted-but-hidden
// by design, so it must always be present regardless of the active tab.
vi.mock('../../chart', () => ({
  LazyChart: () => <div data-testid="chart-panel" />,
}))
vi.mock('../../orderbook', () => ({
  Orderbook: () => <div data-testid="orderbook-panel" />,
}))
vi.mock('../../trades-tape', () => ({
  TradesTape: () => <div data-testid="trades-panel" />,
}))

import { useMobileTabPanel } from '../use-mobile-tab-panel'
import { MobileTabPanel } from '../MobileTabPanel'

vi.mock('../use-mobile-tab-panel', () => ({
  useMobileTabPanel: vi.fn(),
}))

const useMobileTabPanelMock = vi.mocked(useMobileTabPanel)

function makeHookReturn(overrides: Partial<UseMobileTabPanelReturn> = {}): UseMobileTabPanelReturn {
  return {
    activeTab: 'chart',
    setActiveTab: vi.fn(),
    tick: 1,
    setTick: vi.fn(),
    tickLadder: [1, 10],
    tickOptions: [
      { value: '1', label: '1' },
      { value: '10', label: '10' },
    ],
    sizeAsset: 'base',
    setSizeAsset: vi.fn(),
    bookSide: 'both',
    setBookSide: vi.fn(),
    baseSymbol: 'BTC',
    quoteSymbol: 'USDC',
    sizeOptions: [
      { value: 'base', label: 'BTC' },
      { value: 'quote', label: 'USDC' },
    ],
    isChartVisible: true,
    isOrderbookVisible: false,
    isTradesVisible: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileTabPanel — heavy stream mount lifecycle', () => {
  it('keeps the chart mounted on every tab but unmounts inactive heavy panels', () => {
    useMobileTabPanelMock.mockReturnValue(makeHookReturn({ activeTab: 'chart', isChartVisible: true }))
    render(<MobileTabPanel />)

    expect(screen.getByTestId('chart-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('orderbook-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('trades-panel')).not.toBeInTheDocument()
  })

  it('mounts the orderbook only when the orderbook tab is active', () => {
    useMobileTabPanelMock.mockReturnValue(
      makeHookReturn({ activeTab: 'orderbook', isChartVisible: false, isOrderbookVisible: true }),
    )
    render(<MobileTabPanel />)

    expect(screen.getByTestId('chart-panel')).toBeInTheDocument()
    expect(screen.getByTestId('orderbook-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('trades-panel')).not.toBeInTheDocument()
  })

  it('mounts the trades tape only when the trades tab is active', () => {
    useMobileTabPanelMock.mockReturnValue(
      makeHookReturn({ activeTab: 'trades', isChartVisible: false, isTradesVisible: true }),
    )
    render(<MobileTabPanel />)

    expect(screen.getByTestId('chart-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('orderbook-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('trades-panel')).toBeInTheDocument()
  })
})
