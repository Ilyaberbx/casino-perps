import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Market } from '@/modules/shared/domain'
import { HotMarketsTicker } from '../HotMarketsTicker'
import { useHotMarketsTicker } from '../use-hot-markets-ticker'
import type { UseHotMarketsTickerReturn } from '../hot-markets-ticker.types'

vi.mock('../use-hot-markets-ticker', () => ({ useHotMarketsTicker: vi.fn() }))

const mockedHook = vi.mocked(useHotMarketsTicker)

function market(symbol: string, change24hPct: number): Market {
  return {
    symbol,
    baseAsset: symbol.replace('-PERP', ''),
    quoteAsset: 'USD',
    venue: 'hl',
    tickSize: 0.01,
    stepSize: 0.001,
    marketType: 'perp',
    volume24h: 1_000_000,
    change24hPct,
  }
}

function hookValue(overrides: Partial<UseHotMarketsTickerReturn>): UseHotMarketsTickerReturn {
  return {
    isLoading: false,
    hotMarkets: [],
    activeSymbol: null,
    marqueeDurationSec: 30,
    onSelect: vi.fn(),
    ...overrides,
  }
}

describe('HotMarketsTicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the loading skeleton while markets load', () => {
    mockedHook.mockReturnValue(hookValue({ isLoading: true }))
    render(<HotMarketsTicker />)
    expect(screen.getByRole('status', { name: /loading hot markets/i })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing when not loading and there are no hot markets', () => {
    mockedHook.mockReturnValue(hookValue({ isLoading: false, hotMarkets: [] }))
    const { container } = render(<HotMarketsTicker />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders each hot market once per group plus a duplicate aria-hidden group', () => {
    const hotMarkets = [market('BTC-PERP', 0.012), market('ETH-PERP', -0.034)]
    mockedHook.mockReturnValue(hookValue({ hotMarkets }))
    const { container } = render(<HotMarketsTicker />)

    // Only the real group is exposed to assistive tech (2 accessible buttons);
    // the decorative duplicate group is aria-hidden, so role queries skip it.
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'View BTC market' })).toBeInTheDocument()
    // But the DOM still holds both groups (2 real + 2 duplicated = 4 buttons)
    // for the seamless loop.
    expect(container.querySelectorAll('button')).toHaveLength(4)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    // Colour-coded change renders for both directions.
    expect(screen.getAllByText('+1.20%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('-3.40%').length).toBeGreaterThan(0)
  })

  it('selects the market on click', async () => {
    const onSelect = vi.fn()
    mockedHook.mockReturnValue(hookValue({ hotMarkets: [market('SOL-PERP', 0.01)], onSelect }))
    render(<HotMarketsTicker />)
    await userEvent.click(screen.getAllByRole('button', { name: 'View SOL market' })[0])
    expect(onSelect).toHaveBeenCalledWith('SOL-PERP')
  })
})
