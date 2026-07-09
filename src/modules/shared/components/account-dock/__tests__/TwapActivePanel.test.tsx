import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { ActiveTwap } from '@/modules/shared/domain'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { makeSyntheticVenue } from '@/modules/shared/hooks/__fixtures__/venue-onboarding'
import { TwapActivePanel } from '../TwapActivePanel'

// The per-row Cancel renders a GatedActionButton, which reads the venue's
// `sign-actions` predicate + the onboarding-sheet controller. A synthetic venue
// with no onboarding slot makes the gate ready (button enabled).
function Providers({ children }: { children: ReactNode }) {
  return (
    <VenueProvider venue={makeSyntheticVenue()}>
      <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
    </VenueProvider>
  )
}

function twap(overrides: Partial<ActiveTwap> = {}): ActiveTwap {
  return {
    identifier: 'twap-1',
    symbol: 'BTC',
    side: 'buy',
    size: 10,
    executedSize: 2.5,
    executedNotionalUsd: 150_000,
    durationMinutes: 30,
    reduceOnly: false,
    randomize: false,
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

const NOW = 1_700_000_000_000 + 10 * 60_000

function renderPanel(props: Partial<Parameters<typeof TwapActivePanel>[0]> = {}) {
  return render(
    <TwapActivePanel
      twaps={[twap()]}
      isLoading={false}
      now={NOW}
      hasTwapController
      selectedIds={new Set()}
      onToggleSelected={() => {}}
      onCancel={() => {}}
      {...props}
    />,
    { wrapper: Providers },
  )
}

describe('TwapActivePanel', () => {
  it('renders the parity columns including Average Price and Progress', () => {
    renderPanel()
    // Unique headers (Cancel also appears as the row button, so assert it via
    // getAllByText below).
    for (const header of ['Asset', 'Side', 'Size', 'Executed', 'Average Price', 'Started At', 'TWAP Duration', 'Time Remaining', 'Progress']) {
      expect(screen.getByText(header)).toBeInTheDocument()
    }
    // 'Cancel' is both the header cell and the per-row button.
    expect(screen.getAllByText('Cancel').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the progress bar with the executed/size percentage', () => {
    renderPanel()
    // executedSize 2.5 / size 10 = 25%
    expect(screen.getByText('25%')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '25')
  })

  it('renders the average price (executedNotionalUsd / executedSize)', () => {
    renderPanel()
    // 150,000 / 2.5 = 60,000
    expect(screen.getByText('$60,000.00')).toBeInTheDocument()
  })

  it('fires onCancel with the twap when the per-row Cancel is clicked', async () => {
    const onCancel = vi.fn()
    renderPanel({ onCancel })
    await userEvent.click(screen.getByRole('button', { name: /cancel twap/i }))
    expect(onCancel).toHaveBeenCalledWith(twap())
  })

  it('hides the select checkbox and per-row Cancel when no twapController', () => {
    renderPanel({ hasTwapController: false })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel twap/i })).not.toBeInTheDocument()
  })

  it('toggles selection when the row checkbox is clicked', async () => {
    const onToggleSelected = vi.fn()
    renderPanel({ onToggleSelected })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelected).toHaveBeenCalledWith('twap-1')
  })

  it('shows the empty state when there are no active twaps', () => {
    renderPanel({ twaps: [] })
    expect(screen.getByText(/no active twap orders/i)).toBeInTheDocument()
  })
})
