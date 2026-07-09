import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Fill } from '@/modules/shared/domain'
import { TradeHistoryRow } from '../TradeHistoryRow'

function fill(overrides: Partial<Fill> = {}): Fill {
  return {
    identifier: 'fill-1',
    orderIdentifier: 'order-1',
    symbol: 'BTC',
    side: 'buy',
    price: 107_000,
    size: 0.00022,
    fee: 0.010613,
    timestamp: 1_700_000_000_000,
    closedPnl: 0.00154,
    direction: 'Open Long',
    crossed: true,
    feeToken: 'USDC',
    ...overrides,
  }
}

function renderRow(overrides: Partial<Fill> = {}) {
  return render(
    <div role="table">
      <TradeHistoryRow fill={fill(overrides)} />
    </div>,
  )
}

describe('TradeHistoryRow', () => {
  it('renders the venue direction as the Side chip, not the raw side', () => {
    renderRow()
    expect(screen.getByText('Open Long')).toBeInTheDocument()
    expect(screen.queryByText('buy')).not.toBeInTheDocument()
  })

  it('falls back to the raw side when the direction is absent', () => {
    renderRow({ direction: undefined })
    expect(screen.getByText('buy')).toBeInTheDocument()
  })

  it('suffixes the Size with the base asset', () => {
    renderRow()
    expect(screen.getByText('0.00022 BTC')).toBeInTheDocument()
  })

  it('denominates the Fee in its feeToken verbatim', () => {
    renderRow()
    expect(screen.getByText('0.010613 USDC')).toBeInTheDocument()
  })

  it('shows the signed Closed PNL denominated in USDC', () => {
    renderRow()
    expect(screen.getByText('+0.00154 USDC')).toBeInTheDocument()
  })

  it('renders -- for Closed PNL when the fill omits it', () => {
    renderRow({ closedPnl: undefined })
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('renders Taker for a crossed fill', () => {
    renderRow({ crossed: true })
    expect(screen.getByText('Taker')).toBeInTheDocument()
  })

  it('renders Maker for a non-crossed fill', () => {
    renderRow({ crossed: false })
    expect(screen.getByText('Maker')).toBeInTheDocument()
  })

  it('renders -- in Type when the crossed flag is absent (false is not absent)', () => {
    const { container } = renderRow({ crossed: undefined })
    expect(container.textContent).toContain('--')
    expect(screen.queryByText('Maker')).not.toBeInTheDocument()
    expect(screen.queryByText('Taker')).not.toBeInTheDocument()
  })

  it('strips the HIP-3 dex prefix from the asset cell, keeping the raw coin out of the DOM', () => {
    const { container } = renderRow({ symbol: 'xyz:NVDA' })
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(container.textContent).not.toContain('xyz:NVDA')
  })

  it('passes a bare perp coin through unchanged', () => {
    renderRow({ symbol: 'ETH', direction: undefined })
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })
})
