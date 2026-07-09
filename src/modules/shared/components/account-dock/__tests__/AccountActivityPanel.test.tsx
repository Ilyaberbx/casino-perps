import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountActivityEntry } from '@/modules/shared/domain'
import type { UsePaginatedHistoryReturn } from '@/modules/shared/hooks/use-paginated-history.types'
import { AccountActivityPanel } from '../AccountActivityPanel'

const ENTRY: AccountActivityEntry = {
  time: 1_700_000_000_000,
  hash: '0xaa00000000000000000000000000000000000000000000000000000000000001',
  delta: { type: 'deposit', usdc: '1500.00' },
}

function fakePagination(
  rows: ReadonlyArray<AccountActivityEntry>,
  overrides: Partial<UsePaginatedHistoryReturn<AccountActivityEntry>> = {},
): UsePaginatedHistoryReturn<AccountActivityEntry> {
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
    ...overrides,
  }
}

describe('AccountActivityPanel', () => {
  it('renders a deposit row across the action / change / USD-value columns', () => {
    render(
      <AccountActivityPanel
        pagination={fakePagination([ENTRY])}
        totalCount={1}
        isLoading={false}
        historyError={null}
      />,
    )
    expect(screen.getByText('Deposit')).toBeInTheDocument()
    expect(screen.getByText('Arbitrum')).toBeInTheDocument()
    expect(screen.getByText('Hyperliquid')).toBeInTheDocument()
    expect(screen.getByText('1,500 USDC')).toBeInTheDocument()
    expect(screen.getByText('$1,500.00')).toBeInTheDocument()
  })

  it('links the time cell to the explorer when the venue provides a URL builder', () => {
    render(
      <AccountActivityPanel
        pagination={fakePagination([ENTRY])}
        totalCount={1}
        isLoading={false}
        historyError={null}
        explorerTxUrl={(hash) => `https://example.test/tx/${hash}`}
      />,
    )
    const link = screen.getByRole('link', { name: /view transaction/i })
    expect(link).toHaveAttribute('href', `https://example.test/tx/${ENTRY.hash}`)
  })

  // Regression: account activity is old & sparse, so a single bounded scan of
  // the recent window often returns nothing while older windows remain. The
  // empty state must still expose the pager so the user can reach that history
  // — otherwise the tab is a dead end (the bug behind "account activity shows
  // nothing" after the per-click history budget was trimmed).
  it('shows the pager when empty but more windows remain to scan', () => {
    render(
      <AccountActivityPanel
        pagination={fakePagination([], { canNext: true })}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    expect(screen.getByText(/no account activity/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled()
  })

  it('pages back through older windows via the Next control when empty', async () => {
    const goNext = vi.fn()
    render(
      <AccountActivityPanel
        pagination={fakePagination([], { canNext: true, goNext })}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(goNext).toHaveBeenCalledTimes(1)
  })

  it('hides the pager once the history is exhausted', () => {
    render(
      <AccountActivityPanel
        pagination={fakePagination([], { canNext: false })}
        totalCount={0}
        isLoading={false}
        historyError={null}
      />,
    )
    expect(screen.getByText(/no account activity/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument()
  })
})
