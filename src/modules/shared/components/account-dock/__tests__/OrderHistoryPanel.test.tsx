import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { HistoricalOrder } from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import { OrderHistoryPanel } from '../OrderHistoryPanel'

const ORDER: HistoricalOrder = {
  identifier: '900123',
  symbol: 'BTC-PERP',
  side: 'buy',
  price: 60000,
  size: 0.25,
  originalSize: 1,
  orderType: 'Limit',
  timeInForce: 'Gtc',
  reduceOnly: false,
  isTrigger: false,
  triggerPrice: 0,
  status: 'filled',
  createdAt: 1_700_000_000_000,
  statusTimestamp: 1_700_000_050_000,
}

function fakePagination(rows: ReadonlyArray<HistoricalOrder>): UsePaginatedHistoryReturn<HistoricalOrder> {
  return {
    pageRows: rows,
    page: 1,
    pageCount: 1,
    canPrev: false,
    canNext: false,
    goPrev: () => {},
    goNext: () => {},
    goToPage: () => {},
    isFetchingMore: false,
  }
}

describe('OrderHistoryPanel', () => {
  it('renders the trade.xyz parity columns', () => {
    render(
      <OrderHistoryPanel
        pagination={fakePagination([])}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    for (const header of ['Filled Size', 'Order Value', 'Reduce Only', 'Trigger Conditions', 'Status', 'Order ID']) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
  })

  it('renders a row with derived filled size, status label, and order id', () => {
    render(
      <OrderHistoryPanel
        pagination={fakePagination([ORDER])}
        totalCount={1}
        isLoading={false}
        historyError={null}
      />,
    )
    // Filled size = originalSize (1) - size (0.25) = 0.75
    expect(screen.getByText('0.75')).toBeInTheDocument()
    expect(screen.getByText('Filled')).toBeInTheDocument()
    expect(screen.getByText('900123')).toBeInTheDocument()
    // Order value = price × originalSize = 60,000
    expect(screen.getByText('$60,000.00')).toBeInTheDocument()
  })

  it('shows the empty state after load when there are no orders', () => {
    render(
      <OrderHistoryPanel
        pagination={fakePagination([])}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    expect(screen.getByText(/no order history/i)).toBeInTheDocument()
  })
})

describe('OrderHistoryPanel — header labels compress via FitCell (Defect 1)', () => {
  it('renders the wide "Trigger Conditions" header inside a FitCell wrapper', () => {
    render(
      <OrderHistoryPanel
        pagination={fakePagination([])}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    // The header text lives inside FitCell's inner span (identified by the
    // `data-fit-align` contract) so it scaleX-compresses instead of clipping.
    const header = screen.getByText('Trigger Conditions')
    expect(header.closest('[data-fit-align]')).not.toBeNull()
  })

  it('renders the opaque "Order ID" header inside a left-or-right FitCell wrapper', () => {
    render(
      <OrderHistoryPanel
        pagination={fakePagination([])}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    const header = screen.getByText('Order ID')
    expect(header.closest('[data-fit-align]')).not.toBeNull()
  })
})
