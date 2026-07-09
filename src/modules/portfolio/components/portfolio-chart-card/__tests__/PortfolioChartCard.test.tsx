import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../../../../shared/providers/theme-provider'
import { PortfolioChartCard } from '../PortfolioChartCard'
import type { ChartStateByMetric } from '../../../pages/portfolio-page.types'

const emptyCharts: ChartStateByMetric = {
  accountValue: { kind: 'ready', points: [] },
  pnl: { kind: 'ready', points: [] },
  perpsPnl: { kind: 'ready', points: [] },
}

const upCharts: ChartStateByMetric = {
  accountValue: {
    kind: 'ready',
    points: [
      { timestamp: 1_000, value: 100 },
      { timestamp: 2_000, value: 110 },
    ],
  },
  pnl: { kind: 'ready', points: [] },
  perpsPnl: { kind: 'ready', points: [] },
}

const downCharts: ChartStateByMetric = {
  accountValue: { kind: 'ready', points: [] },
  pnl: {
    kind: 'ready',
    points: [
      { timestamp: 1_000, value: 5 },
      { timestamp: 2_000, value: -2.5 },
    ],
  },
  perpsPnl: { kind: 'ready', points: [] },
}

function renderCard(overrides: Partial<Parameters<typeof PortfolioChartCard>[0]> = {}) {
  const props = {
    chartMetric: 'pnl' as const,
    onChartMetricChange: vi.fn(),
    charts: emptyCharts,
    window: '7D' as const,
    hasPortfolio: true,
    ...overrides,
  }
  return render(
    <ThemeProvider>
      <PortfolioChartCard {...props} />
    </ThemeProvider>,
  )
}

describe('PortfolioChartCard', () => {
  it('renders chart metric switcher when portfolio capability present', () => {
    renderCard()
    expect(screen.getByRole('group', { name: /chart metric selector/i })).toBeInTheDocument()
  })

  it('marks active metric button as pressed', () => {
    renderCard({ chartMetric: 'pnl' })
    const pnlBtn = screen.getByRole('button', { name: /^pnl$/i })
    expect(pnlBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChartMetricChange when a metric button is clicked', async () => {
    const onChartMetricChange = vi.fn()
    renderCard({ onChartMetricChange })
    await userEvent.click(screen.getByRole('button', { name: /account value/i }))
    expect(onChartMetricChange).toHaveBeenCalledWith('accountValue')
  })

  it('renders unsupported message when hasPortfolio is false', () => {
    renderCard({ hasPortfolio: false })
    expect(screen.getByText(/chart not supported/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /chart metric selector/i })).not.toBeInTheDocument()
  })

  it('renders all three metric options', () => {
    renderCard()
    expect(screen.getByRole('button', { name: /account value/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^pnl$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /perps pnl/i })).toBeInTheDocument()
  })

  it('hides the period delta badge when the active series is empty', () => {
    renderCard()
    expect(screen.queryByLabelText(/window change/i)).not.toBeInTheDocument()
  })

  it('renders a positive period delta badge for an up-trending series', () => {
    renderCard({ chartMetric: 'accountValue', charts: upCharts })
    const badge = screen.getByLabelText(/window change/i)
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toBe('+$10.00 (+10.00%)')
  })

  it('renders a negative period delta badge for a down-trending PNL series', () => {
    renderCard({ chartMetric: 'pnl', charts: downCharts })
    const badge = screen.getByLabelText(/window change/i)
    expect(badge.textContent).toBe('-$7.50 (-150.00%)')
  })
})
