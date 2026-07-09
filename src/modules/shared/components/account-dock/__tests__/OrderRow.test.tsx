import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Order } from '@/modules/shared/domain'
import { OrderRow } from '../OrderRow'

function order(overrides: Partial<Order> = {}): Order {
  return {
    identifier: 'order-1',
    symbol: 'BTC',
    side: 'buy',
    size: 1,
    price: 107_000,
    filledSize: 0,
    status: 'open',
    orderType: 'limit',
    timestamp: 1_700_000_000_000,
    originalSize: 1,
    reduceOnly: false,
    ...overrides,
  }
}

const baseProps = {
  onCancel: () => {},
  onModify: () => {},
  hasTrader: false,
  hasModifyOrder: false,
  showActionsColumn: true,
}

describe('OrderRow — HIP-3 symbol display', () => {
  it('renders the asset name without the dex prefix', () => {
    const { container } = render(<OrderRow order={order({ symbol: 'xyz:NVDA' })} {...baseProps} />)
    expect(screen.getByText('NVDA')).toBeInTheDocument()
    expect(container.textContent).not.toContain('xyz:NVDA')
  })

  it('passes a bare perp coin through unchanged', () => {
    render(<OrderRow order={order({ symbol: 'ETH' })} {...baseProps} />)
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })
})

describe('OrderRow — Actions cell hidden while spectating', () => {
  it('renders no Cancel/Modify buttons when the column is hidden, even with a trader', () => {
    // The cell is dropped on `showActionsColumn`, independent of `hasTrader` — so
    // a hidden column never leaves a stray Cancel/Modify button behind.
    render(
      <OrderRow
        order={order()}
        {...baseProps}
        hasTrader
        hasModifyOrder
        showActionsColumn={false}
      />,
    )

    expect(screen.queryByRole('button', { name: /cancel order/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /modify order/i })).toBeNull()
  })
})

describe('OrderRow — single-line FitCell wrapper (Issue 1)', () => {
  it('renders the order price inside a single-line FitCell container', () => {
    // The price text renders inside FitCell, identified by FitCell's
    // `data-fit-align` contract — guards the inline-cell rule for the row.
    render(<OrderRow order={order({ price: 107_000, size: 1, originalSize: 1 })} {...baseProps} />)
    const value = screen.getByText('107,000')
    expect(value.closest('[data-fit-align]')).not.toBeNull()
  })
})
