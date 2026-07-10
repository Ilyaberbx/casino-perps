import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { PortfolioSummaryCard } from '../PortfolioSummaryCard'
import type { PortfolioSnapshot } from '../../../../shared/domain'

// Pro mode is gone (PRD-0008 D7): the card always renders its condensed
// (`simple`) form. The `_mode` params are kept ignored so existing call sites
// still compile without a signature churn.
type LegacyTradingMode = 'pro' | 'simple'

const baseSnapshot: PortfolioSnapshot = {
  accountValue: 10_000,
  // Window-keyed (ADR-0039): each period carries a distinct value so the row
  // tracks the Period selector. 24H = 200 / 5,000 keeps the existing assertions.
  pnl: { '24H': 200, '7D': -350, '30D': -575, AllTime: 381 },
  perpsPnl: 100,
  volume: { '24H': 5_000, '7D': 25_716, '30D': 25_717, AllTime: 25_834 },
  spotEquity: 4_000,
  perpsEquity: 6_000,
  fourteenDayVolume: 50_000,
  timestamp: 1,
}

function wrapMode(_mode?: LegacyTradingMode) {
  return ({ children }: { children: ReactNode }) => <>{children}</>
}

function renderCard(
  overrides: Partial<Parameters<typeof PortfolioSummaryCard>[0]> = {},
  mode?: LegacyTradingMode,
) {
  const props = {
    snapshot: baseSnapshot,
    window: '24H' as const,
    onWindowChange: vi.fn(),
    scope: 'all' as const,
    onScopeChange: vi.fn(),
    isConnected: true,
    isLoading: false,
    isSegregated: true,
    ...overrides,
  }
  return render(<PortfolioSummaryCard {...props} />, { wrapper: wrapMode(mode) })
}

describe('PortfolioSummaryCard', () => {
  beforeEach(() => localStorage.clear())

  // Pro mode is gone (PRD-0008 D7): the scope/period controls are always the
  // condensed dropdowns, covered by the "Simple mode" block below (the Pro
  // segmented-button variant was removed).

  it('shows PNL and Volume from snapshot when connected', () => {
    renderCard({ isConnected: true })
    expect(screen.getByText('+$200.00')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
  })

  it('selects the PNL/Volume for the active window (ADR-0039)', () => {
    const { rerender } = renderCard({ window: '24H' })
    expect(screen.getByText('+$200.00')).toBeInTheDocument()
    rerender(
      <PortfolioSummaryCard
        snapshot={baseSnapshot}
        window="AllTime"
        onWindowChange={vi.fn()}
        scope="all"
        onScopeChange={vi.fn()}
        isConnected
        isLoading={false}
        isSegregated
      />,
    )
    expect(screen.getByText('+$381.00')).toBeInTheDocument()
    expect(screen.getByText('$25,834.00')).toBeInTheDocument()
    expect(screen.queryByText('+$200.00')).not.toBeInTheDocument()
  })

  it('renders the reference equity rows (#275)', () => {
    renderCard({ isConnected: true })
    expect(screen.getByText(/^total equity$/i)).toBeInTheDocument()
    expect(screen.getByText(/perp account equity/i)).toBeInTheDocument()
    expect(screen.getByText(/spot account equity/i)).toBeInTheDocument()
    expect(screen.getByText('$10,000.00')).toBeInTheDocument()
    expect(screen.getByText('$6,000.00')).toBeInTheDocument()
    expect(screen.getByText('$4,000.00')).toBeInTheDocument()
  })

  it('renders a Max Drawdown row with a dash (Venue-unsupplied, never computed)', () => {
    renderCard({ isConnected: true })
    expect(screen.getByText(/max drawdown/i)).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows $0.00 values when disconnected', () => {
    renderCard({ isConnected: false })
    const zeros = screen.getAllByText('$0.00')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('shows placeholder dashes when snapshot is null and connected (not loading)', () => {
    renderCard({ snapshot: null, isConnected: true, isLoading: false })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('shows loading skeletons (not values) when connected and loading', () => {
    renderCard({ snapshot: null, isConnected: true, isLoading: true })
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.queryByText('+$200.00')).not.toBeInTheDocument()
  })

  describe('Simple mode (#276)', () => {
    it('renders the scope and period controls as dropdowns', () => {
      renderCard({}, 'simple')
      expect(screen.getByRole('button', { name: /accounts scope/i })).toHaveAttribute(
        'aria-haspopup',
        'listbox',
      )
      expect(screen.getByRole('button', { name: /period selector/i })).toHaveAttribute(
        'aria-haspopup',
        'listbox',
      )
      // No segmented group in Simple mode.
      expect(screen.queryByRole('group', { name: /accounts scope/i })).not.toBeInTheDocument()
    })

    it('calls onWindowChange when a period option is chosen from the dropdown', async () => {
      const user = userEvent.setup()
      const onWindowChange = vi.fn()
      renderCard({ onWindowChange }, 'simple')
      await user.click(screen.getByRole('button', { name: /period selector/i }))
      await user.click(screen.getByRole('option', { name: /30 days/i }))
      expect(onWindowChange).toHaveBeenCalledWith('30D')
    })
  })
})
