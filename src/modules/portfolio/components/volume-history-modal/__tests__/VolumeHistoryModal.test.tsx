import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Venue, VolumeHistory, VolumeHistoryReader } from '@/modules/shared/domain'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { VolumeHistoryModal } from '../VolumeHistoryModal'

function buildReader(history: VolumeHistory): VolumeHistoryReader {
  return {
    subscribe(onUpdate) {
      onUpdate(history)
      return () => {}
    },
  }
}

function buildVenue(history: VolumeHistory | null): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      volumeHistory: history === null ? undefined : buildReader(history),
    },
  }
}

function renderModal(venue: Venue, isOpen = true, onClose = () => {}) {
  return render(
    <VenueContext.Provider value={venue}>
      <VolumeHistoryModal isOpen={isOpen} onClose={onClose} />
    </VenueContext.Provider>,
  )
}

describe('VolumeHistoryModal', () => {
  it('renders the heading "Your Volume History"', () => {
    renderModal(buildVenue({ entries: [] }))
    expect(screen.getByRole('heading', { name: /your volume history/i })).toBeInTheDocument()
  })

  it('renders the column headers', () => {
    renderModal(buildVenue({ entries: [] }))
    expect(screen.getByText(/date \(utc\)/i)).toBeInTheDocument()
    expect(screen.getByText(/exchange volume/i)).toBeInTheDocument()
    expect(screen.getByText(/your weighted maker volume/i)).toBeInTheDocument()
    expect(screen.getByText(/your weighted taker volume/i)).toBeInTheDocument()
  })

  it('renders one row per VolumeHistoryEntry plus a Total row that sums all entries', () => {
    renderModal(
      buildVenue({
        entries: [
          { date: '2026-05-09', exchangeVolume: 1_000_000, userMakerVolume: 100, userTakerVolume: 200 },
          { date: '2026-05-10', exchangeVolume: 2_000_000, userMakerVolume: 50, userTakerVolume: 400 },
        ],
      }),
    )
    expect(screen.getByText('2026-05-09')).toBeInTheDocument()
    expect(screen.getByText('2026-05-10')).toBeInTheDocument()
    const total = screen.getByTestId('volume-history-total')
    expect(total).toHaveTextContent(/total/i)
    expect(total).toHaveTextContent('$3,000,000.00')
    expect(total).toHaveTextContent('$150.00')
    expect(total).toHaveTextContent('$600.00')
  })

  it('renders zero totals when no entries (empty / disconnected state)', () => {
    renderModal(buildVenue({ entries: [] }))
    const total = screen.getByTestId('volume-history-total')
    expect(total).toHaveTextContent('$0.00')
  })

  it('renders the footer note about UTC dates and fee-tier counting', () => {
    renderModal(buildVenue({ entries: [] }))
    expect(screen.getByText(/dates do not include the current day/i)).toBeInTheDocument()
    expect(screen.getByText(/spot volume counts double/i)).toBeInTheDocument()
  })

  it('renders zero totals when the venue does not provide a volumeHistory capability', () => {
    renderModal(buildVenue(null))
    const total = screen.getByTestId('volume-history-total')
    expect(total).toHaveTextContent('$0.00')
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderModal(buildVenue({ entries: [] }), true, onClose)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays mounted but hidden + inert when isOpen is false (keepMounted, issue #267)', () => {
    // keepMounted keeps the subscription warm so opening shows data with no
    // empty-frame flicker; the closed modal must be inert (non-interactive).
    renderModal(buildVenue({ entries: [] }), false)
    const backdrop = screen.getByTestId('modal-backdrop')
    expect(backdrop).toHaveAttribute('inert')
  })
})
