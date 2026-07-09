import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HistoryTab } from '../HistoryTab'
import { HISTORY_EMPTY_COPY } from '../perp-suggestion-sheet.constants'
import { makeStoredSuggestion } from '../__fixtures__/suggestions'
import type { HistoryState } from '../perp-suggestion-sheet.types'

const NOW_MS = new Date('2026-06-14T12:02:00.000Z').getTime()

describe('HistoryTab — phases', () => {
  it('renders a loading skeleton while loading', () => {
    render(<HistoryTab history={{ phase: 'loading' }} onReopen={vi.fn()} />)
    expect(screen.getByTestId('history-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument()
  })

  it('renders an error callout on failure', () => {
    const history: HistoryState = { phase: 'error', message: 'Could not load history.' }
    render(<HistoryTab history={history} onReopen={vi.fn()} />)
    expect(screen.getByText('Could not load history.')).toBeInTheDocument()
    expect(screen.getByText('History unavailable')).toBeInTheDocument()
  })

  it('renders the empty state copy when there are no rows', () => {
    const history: HistoryState = { phase: 'ready', rows: [], nowMs: NOW_MS }
    render(<HistoryTab history={history} onReopen={vi.fn()} />)
    expect(screen.getByText(HISTORY_EMPTY_COPY)).toBeInTheDocument()
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument()
  })
})

describe('HistoryTab — ready rows', () => {
  it('renders the rows in the order provided (newest-first as supplied)', () => {
    const newest = makeStoredSuggestion({ id: 'newest', agentId: 'minara' })
    const older = makeStoredSuggestion({ id: 'older', agentId: 'native' })
    const history: HistoryState = {
      phase: 'ready',
      rows: [newest, older],
      nowMs: NOW_MS,
    }
    render(<HistoryTab history={history} onReopen={vi.fn()} />)
    const rows = screen.getAllByTestId('history-row')
    expect(rows).toHaveLength(2)
    // Provider is shown as an icon: Minara's mark vs. the three-eye motif.
    expect(within(rows[0]).getByRole('img', { name: 'Minara' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('img', { name: 'AI agent' })).toBeInTheDocument()
  })

  it('marks a row expired when its expiresAt is at or before nowMs', () => {
    const valid = makeStoredSuggestion({
      id: 'valid',
      expiresAt: '2026-06-14T12:05:00.000Z',
    })
    const expired = makeStoredSuggestion({
      id: 'expired',
      expiresAt: '2026-06-14T11:55:00.000Z',
    })
    const history: HistoryState = {
      phase: 'ready',
      rows: [valid, expired],
      nowMs: NOW_MS,
    }
    render(<HistoryTab history={history} onReopen={vi.fn()} />)
    const rows = screen.getAllByTestId('history-row')
    expect(rows[0]).toHaveAttribute('data-expired', 'false')
    expect(rows[1]).toHaveAttribute('data-expired', 'true')
    expect(within(rows[1]).getByTestId('expired-badge')).toBeInTheDocument()
    expect(within(rows[0]).queryByTestId('expired-badge')).not.toBeInTheDocument()
  })

  it('forwards the clicked row to onReopen', async () => {
    const user = userEvent.setup()
    const onReopen = vi.fn()
    const row = makeStoredSuggestion({ id: 'click-me' })
    const history: HistoryState = { phase: 'ready', rows: [row], nowMs: NOW_MS }
    render(<HistoryTab history={history} onReopen={onReopen} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(onReopen).toHaveBeenCalledWith(row)
  })
})
