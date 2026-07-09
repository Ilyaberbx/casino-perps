import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TwapHistoryEntry } from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import { TwapHistoryPanel } from '../TwapHistoryPanel'

const ENTRY: TwapHistoryEntry = {
  identifier: 'twap-hist-1',
  symbol: 'BTC',
  side: 'buy',
  size: 0.4,
  executedSize: 0.4,
  executedNotionalUsd: 24_000,
  status: 'finished',
  createdAt: 1_700_000_000_000,
  endedAt: 1_700_003_600_000,
  durationMinutes: 60,
  reduceOnly: false,
  randomize: true,
}

function fakePagination(rows: ReadonlyArray<TwapHistoryEntry>): UsePaginatedHistoryReturn<TwapHistoryEntry> {
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

describe('TwapHistoryPanel', () => {
  it('renders the parity columns', () => {
    render(
      <TwapHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={false} historyError={null} />,
    )
    for (const header of ['Time', 'Asset', 'Side', 'Total Size', 'Executed Size', 'Average Price', 'TWAP Duration', 'Reduce Only', 'Randomize', 'Status']) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
  })

  it('renders a row with average price, duration, randomize, and status', () => {
    render(
      <TwapHistoryPanel pagination={fakePagination([ENTRY])} totalCount={1} isLoading={false} historyError={null} />,
    )
    // avg price = 24,000 / 0.4 = 60,000
    expect(screen.getByText('$60,000.00')).toBeInTheDocument()
    expect(screen.getByText('1h 0m')).toBeInTheDocument()
    expect(screen.getByText('Finished')).toBeInTheDocument()
    // Randomize = Yes; Reduce Only = No
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('shows the empty state after load', () => {
    render(
      <TwapHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={false} historyError={null} />,
    )
    expect(screen.getByText(/no twap history/i)).toBeInTheDocument()
  })

  it('shows the loading skeleton on the initial empty load', () => {
    render(
      <TwapHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={true} historyError={null} />,
    )
    expect(screen.getByLabelText(/loading twap history/i)).toBeInTheDocument()
  })

  it('renders an error banner when historyError is set', () => {
    render(
      <TwapHistoryPanel pagination={fakePagination([])} totalCount={0} isLoading={false} historyError="Network error fetching TWAP history." />,
    )
    expect(screen.getByText(/network error fetching twap history/i)).toBeInTheDocument()
  })
})
