import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryRow } from '../HistoryRow'
import { EXPIRED_BADGE, REOPEN_LABEL } from '../perp-suggestion-sheet.constants'
import { makeRawSuggestion, makeStoredSuggestion } from '../__fixtures__/suggestions'

describe('HistoryRow', () => {
  it('renders the market icon, symbol, provider icon, side, and confidence', () => {
    const row = makeStoredSuggestion({
      agentId: 'minara',
      requestParams: { symbol: 'ETH', style: 'scalping', marginUsd: 100, leverage: 5 },
      rawSuggestion: makeRawSuggestion({ side: 'short', confidence: 81 }),
    })
    render(<HistoryRow row={row} expired={false} onReopen={vi.fn()} />)
    const rowEl = screen.getByTestId('history-row')
    // Market: AssetIcon labels its img with the base asset; symbol text alongside.
    expect(screen.getByAltText('ETH')).toBeInTheDocument()
    expect(rowEl).toHaveTextContent('ETH')
    // Provider: the Minara mark replaces the old text badge.
    expect(screen.getByAltText('Minara')).toBeInTheDocument()
    expect(rowEl).not.toHaveTextContent('minara')
    expect(rowEl).toHaveTextContent('short')
    expect(rowEl).toHaveTextContent('81%')
  })

  it('does not show the expired badge for a valid row', () => {
    render(
      <HistoryRow row={makeStoredSuggestion()} expired={false} onReopen={vi.fn()} />,
    )
    expect(screen.queryByTestId('expired-badge')).not.toBeInTheDocument()
    expect(screen.getByTestId('history-row')).toHaveAttribute('data-expired', 'false')
  })

  it('shows the expired badge and marks the row expired', () => {
    render(
      <HistoryRow row={makeStoredSuggestion()} expired onReopen={vi.fn()} />,
    )
    expect(screen.getByTestId('expired-badge')).toHaveTextContent(EXPIRED_BADGE)
    expect(screen.getByTestId('history-row')).toHaveAttribute('data-expired', 'true')
  })

  it('calls onReopen with the row when the open button is clicked', async () => {
    const user = userEvent.setup()
    const onReopen = vi.fn()
    const row = makeStoredSuggestion({ id: 'reopen-me' })
    render(<HistoryRow row={row} expired={false} onReopen={onReopen} />)
    await user.click(screen.getByRole('button', { name: REOPEN_LABEL }))
    expect(onReopen).toHaveBeenCalledWith(row)
  })
})
