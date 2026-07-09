import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Fill } from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import { TwapFillHistoryPanel } from '../TwapFillHistoryPanel'

const FILL: Fill = {
  identifier: '7-42',
  orderIdentifier: '1',
  symbol: 'BTC',
  side: 'buy',
  price: 60_000,
  size: 0.01,
  fee: 0.24,
  timestamp: 1_700_000_000_000,
  closedPnl: 5,
  direction: 'Open Long',
  crossed: true,
  feeToken: 'USDC',
}

function fakePagination(rows: ReadonlyArray<Fill>): UsePaginatedHistoryReturn<Fill> {
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

describe('TwapFillHistoryPanel', () => {
  it('renders the parity columns', () => {
    render(
      <TwapFillHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={false} historyError={null} />,
    )
    for (const header of ['Time', 'Asset', 'Side', 'Price', 'Size', 'Trade Value', 'Fee', 'Closed PNL']) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
  })

  it('renders a slice fill row with the computed trade value', () => {
    render(
      <TwapFillHistoryPanel pagination={fakePagination([FILL])} totalCount={1} isLoading={false} historyError={null} />,
    )
    // trade value = price × size = 60,000 × 0.01 = 600 USDC
    expect(screen.getByText('600 USDC')).toBeInTheDocument()
    expect(screen.getByText('+5 USDC')).toBeInTheDocument()
  })

  it('shows the empty state after load', () => {
    render(
      <TwapFillHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={false} historyError={null} />,
    )
    expect(screen.getByText(/no twap fill history/i)).toBeInTheDocument()
  })

  it('shows the loading skeleton on the initial empty load', () => {
    render(
      <TwapFillHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={true} historyError={null} />,
    )
    expect(screen.getByLabelText(/loading twap fill history/i)).toBeInTheDocument()
  })
})
