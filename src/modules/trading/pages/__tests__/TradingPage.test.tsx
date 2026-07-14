import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradingPage } from '../TradingPage'

// The chart is a lazy lightweight-charts wrapper; stub it so the page renders
// without a canvas / venue stream.
vi.mock('../../components/chart', () => ({
  LazyChart: () => <div data-testid="mock-chart" />,
}))

// The market strip and the ticket own their own venue subscriptions; this suite
// asserts the page's composition, not their internals (each is covered by its
// own tests).
vi.mock('../../components/top-bar', () => ({
  TopBar: () => <div data-testid="mock-top-bar" />,
}))
vi.mock('../../components/order-entry', () => ({
  SimpleOrderTicket: () => <div data-testid="mock-order-ticket" />,
}))
vi.mock('../../components/position-panel', () => ({
  PositionPanel: () => <div data-testid="mock-position-panel" />,
}))
vi.mock('../../providers/favorites-provider', () => ({
  FavoritesProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}))

describe('TradingPage', () => {
  it('composes the market strip, the chart, the position panel, and the order ticket', () => {
    render(<TradingPage />)
    expect(screen.getByTestId('trading-shell')).toBeInTheDocument()
    expect(screen.getByTestId('mock-top-bar')).toBeInTheDocument()
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
    expect(screen.getByTestId('mock-position-panel')).toBeInTheDocument()
    expect(screen.getByTestId('mock-order-ticket')).toBeInTheDocument()
  })

  it('renders no bet ticket — the casino affordances are gone', () => {
    render(<TradingPage />)
    expect(screen.queryByText(/your bet/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/multiplier/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^up/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^down/i })).not.toBeInTheDocument()
  })
})
