import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Star } from 'lucide-react'
import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { MarketGrid } from '../MarketGrid'

function market(symbol: string, change24hPct?: number): Market {
  return {
    symbol,
    baseAsset: symbol,
    quoteAsset: 'USDC',
    venue: 'hl',
    tickSize: 0,
    stepSize: 0,
    marketType: 'perp',
    change24hPct,
  }
}

function renderGrid(markets: Market[], isLoading = false) {
  return render(
    <MemoryRouter>
      <MarketGrid
        title="Favorites"
        icon={Star}
        markets={markets}
        isLoading={isLoading}
        emptyMessage="Star a market to see it here."
      />
    </MemoryRouter>,
  )
}

describe('MarketGrid', () => {
  it('renders the section title', () => {
    renderGrid([market('BTC-PERP')])
    expect(screen.getByRole('heading', { name: 'Favorites' })).toBeInTheDocument()
  })

  it('links each card to its /trade/:symbol screen', () => {
    renderGrid([market('BTC-PERP'), market('xyz:AAPL')])
    expect(screen.getByRole('link', { name: 'BTC-PERP' })).toHaveAttribute('href', '/trade/BTC-PERP')
    // HIP-3 colon is percent-encoded in the path segment.
    expect(screen.getByRole('link', { name: 'xyz:AAPL' })).toHaveAttribute(
      'href',
      '/trade/xyz%3AAAPL',
    )
  })

  it('renders a card per market', () => {
    renderGrid([market('A'), market('B'), market('C')])
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('shows the empty message once loaded with no markets', () => {
    renderGrid([])
    expect(screen.getByText('Star a market to see it here.')).toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('shows skeletons — not the empty message — while loading', () => {
    renderGrid([], true)
    expect(screen.queryByText('Star a market to see it here.')).not.toBeInTheDocument()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  // Unlike MarketCarousel, a focused grid *is* the see-all.
  it('renders no "See all" link', () => {
    renderGrid([market('BTC-PERP')])
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument()
  })
})
