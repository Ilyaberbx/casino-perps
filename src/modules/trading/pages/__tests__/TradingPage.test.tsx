import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TradingPage } from '../TradingPage'
import * as useIsMobileModule from '../../../shared/hooks/use-is-mobile'

vi.mock('../../providers/favorites-provider', () => ({
  FavoritesProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}))
vi.mock('../../components/top-bar', () => ({
  // Render `mobileAction` so the trade page's compact Place Order trigger (passed
  // into TopBar's mobile identity row) is assertable in the header.
  TopBar: ({ mobileAction }: { mobileAction?: import('react').ReactNode }) => (
    <div data-testid="mock-top-bar">{mobileAction}</div>
  ),
}))
vi.mock('../../components/chart', () => ({
  Chart: () => <div data-testid="mock-chart" />,
  LazyChart: () => <div data-testid="mock-chart" />,
}))
vi.mock('../../components/order-entry', () => ({
  OrderEntry: () => <div data-testid="mock-order-entry" />,
}))
vi.mock('../../components/trade-equity-card', () => ({
  TradeEquityCard: () => <div data-testid="mock-trade-equity-card" />,
}))
vi.mock('@/modules/shared/components/account-dock', () => ({
  AccountDock: () => <div data-testid="mock-account-dock" />,
}))
vi.mock('@/modules/shared/components/connection-status-bar', () => ({
  ConnectionStatusBar: () => <div data-testid="mock-connection-status-bar" />,
}))
vi.mock('../../providers/selected-market-provider', () => ({
  useSelectedMarketContext: () => ({ setSelectedMarket: () => {} }),
}))
vi.mock('../../components/mobile-trade-dock', () => ({
  MobileTradeDock: () => (
    <div data-testid="trading-mobile-bottom-nav-slot">
      <div data-testid="mock-mobile-trade-dock" />
    </div>
  ),
}))

describe('TradingPage — desktop shell', () => {
  it('renders a viewport-locked two-column shell with right rail = OrderEntry', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    const shell = screen.getByTestId('trading-shell-desktop')
    expect(shell).toBeInTheDocument()

    const rightColumn = within(shell).getByTestId('trading-right-column')
    expect(within(rightColumn).getByTestId('mock-order-entry')).toBeInTheDocument()
    expect(within(rightColumn).getByTestId('mock-trade-equity-card')).toBeInTheDocument()
    expect(within(rightColumn).queryByTestId('mock-account-dock')).not.toBeInTheDocument()
  })

  it('left column stacks the chart card (TopBar + Chart) on top and AccountDock below', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    const leftColumn = screen.getByTestId('trading-left-column')
    const chartCard = within(leftColumn).getByTestId('trading-chart-card')
    expect(within(chartCard).getByTestId('mock-top-bar')).toBeInTheDocument()
    expect(within(chartCard).getByTestId('mock-chart')).toBeInTheDocument()

    const positionsCard = within(leftColumn).getByTestId('trading-positions-card')
    expect(within(positionsCard).getByTestId('mock-account-dock')).toBeInTheDocument()
  })
})

describe('TradingPage — mobile shell', () => {
  beforeEach(() => {
    vi.spyOn(useIsMobileModule, 'useIsMobile').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a 3-region mobile shell: sticky header, scroll body, bottom-nav slot', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    const shell = screen.getByTestId('trading-shell-mobile')
    expect(shell).toHaveAttribute('data-mode', 'simple')
    expect(within(shell).getByTestId('trading-mobile-header')).toBeInTheDocument()
    expect(within(shell).getByTestId('trading-mobile-scroll-body')).toBeInTheDocument()
    expect(within(shell).getByTestId('trading-mobile-bottom-nav-slot')).toBeInTheDocument()
  })

  it('mobile scroll body stacks a compact chart, the equity card, and the positions card', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    const scrollBody = screen.getByTestId('trading-mobile-scroll-body')
    const simpleChart = within(scrollBody).getByTestId('trading-mobile-simple-chart')
    expect(within(simpleChart).getByTestId('mock-chart')).toBeInTheDocument()
    expect(within(scrollBody).getByTestId('mock-trade-equity-card')).toBeInTheDocument()
    expect(within(scrollBody).getByTestId('mock-account-dock')).toBeInTheDocument()
    // Order entry is no longer an inline card — it opens in a header-triggered Sheet.
    expect(within(scrollBody).queryByTestId('mock-order-entry')).not.toBeInTheDocument()
  })

  it('mobile header carries the Place Order CTA that opens the order-entry sheet', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    const header = screen.getByTestId('trading-mobile-header')
    expect(within(header).getByTestId('mobile-place-order-button')).toBeInTheDocument()
    expect(within(header).getByRole('button', { name: /place order/i })).toBeInTheDocument()
    // The order ticket lives in the Sheet (portaled to the document body), not the scroll body.
    expect(screen.getByTestId('mock-order-entry')).toBeInTheDocument()
  })

  it('mounts the MobileTradeDock (footer) on mobile', () => {
    render(
      <MemoryRouter>
        <TradingPage />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('mock-mobile-trade-dock')).toBeInTheDocument()
  })
})
