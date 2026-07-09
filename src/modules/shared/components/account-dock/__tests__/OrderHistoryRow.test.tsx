import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { HistoricalOrder } from '@/modules/shared/domain'
import { OrderHistoryRow } from '../OrderHistoryRow'

function historicalOrder(overrides: Partial<HistoricalOrder> = {}): HistoricalOrder {
  return {
    identifier: 'hist-1',
    symbol: 'BTC',
    side: 'buy',
    price: 107_000,
    size: 1,
    originalSize: 1,
    orderType: 'Limit',
    timeInForce: 'Gtc',
    reduceOnly: false,
    isTrigger: false,
    triggerPrice: 0,
    status: 'filled',
    createdAt: 1_700_000_000_000,
    statusTimestamp: 1_700_000_000_000,
    ...overrides,
  }
}

describe('OrderHistoryRow — HIP-3 symbol display', () => {
  it('renders the asset name without the dex prefix', () => {
    const { container } = render(<OrderHistoryRow order={historicalOrder({ symbol: 'xyz:NVDA' })} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(container.textContent).not.toContain('xyz:NVDA')
  })

  it('passes a bare perp coin through unchanged', () => {
    render(<OrderHistoryRow order={historicalOrder({ symbol: 'ETH' })} />)
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })
})
