import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { describe, it, expect } from 'vitest'
import type { Market } from '@/modules/shared/domain'
import { MarketCarousel } from '../MarketCarousel'

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

function renderCarousel(
  markets: Market[],
  isLoading = false,
  seeAllHref: string | null = '/?view=hot',
) {
  return render(
    <MemoryRouter>
      <MarketCarousel
        title="Hot Markets"
        icon={Flame}
        markets={markets}
        isLoading={isLoading}
        seeAllHref={seeAllHref}
      />
    </MemoryRouter>,
  )
}

describe('MarketCarousel', () => {
  // The "All Markets" row is already the full remainder — it has nowhere to go.
  it('renders no "See all" link when the section has no focused view', () => {
    renderCarousel([market('BTC-PERP')], false, null)
    expect(screen.queryByRole('link', { name: /see all/i })).not.toBeInTheDocument()
  })

  it('links each card to its /trade/:symbol screen', () => {
    renderCarousel([market('BTC-PERP'), market('xyz:AAPL')])
    expect(screen.getByRole('link', { name: 'BTC-PERP' })).toHaveAttribute(
      'href',
      '/trade/BTC-PERP',
    )
    // HIP-3 colon is percent-encoded in the path segment.
    expect(screen.getByRole('link', { name: 'xyz:AAPL' })).toHaveAttribute(
      'href',
      '/trade/xyz%3AAAPL',
    )
  })

  it('converts the fractional 24h change to the poster-card percentage', () => {
    renderCarousel([market('BTC-PERP', 0.024)])
    expect(screen.getByText('+2.4%')).toBeInTheDocument()
  })

  it('renders the section title and a See all link', () => {
    renderCarousel([market('BTC-PERP')])
    expect(screen.getByRole('heading', { name: 'Hot Markets' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /see all/i })).toHaveAttribute('href', '/?view=hot')
  })

  it('shows a plain empty line when loaded with no markets', () => {
    renderCarousel([], false)
    expect(screen.getByText(/nothing here right now/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'BTC-PERP' })).toBeNull()
  })

  it('disables both scroll arrows when there is no overflow', () => {
    renderCarousel([market('BTC-PERP')])
    expect(screen.getByRole('button', { name: /scroll hot markets left/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /scroll hot markets right/i })).toBeDisabled()
  })
})
