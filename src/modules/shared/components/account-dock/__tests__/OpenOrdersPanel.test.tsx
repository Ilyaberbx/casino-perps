import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Order } from '@/modules/shared/domain'
import { OpenOrdersPanel } from '../OpenOrdersPanel'

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
  orders: [order()],
  isLoading: false,
  onCancelOrder: () => {},
  onModifyOrder: () => {},
  cancelError: null,
  hasTrader: false,
  hasModifyOrder: false,
  showActionsColumn: true,
}

describe('OpenOrdersPanel — Actions column hidden while spectating', () => {
  it('drops the Actions header when showActionsColumn is false', () => {
    render(<OpenOrdersPanel {...baseProps} showActionsColumn={false} />)

    expect(screen.queryByText('Actions')).toBeNull()
  })

  it('renders the Actions header when showActionsColumn is true', () => {
    render(<OpenOrdersPanel {...baseProps} showActionsColumn />)

    expect(screen.getByText('Actions')).toBeInTheDocument()
  })
})
