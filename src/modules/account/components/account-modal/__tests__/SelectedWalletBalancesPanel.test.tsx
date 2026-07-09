import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode } from 'react'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { useVenueOnboardingSheet } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import {
  makeVenueOnboarding,
  makeOnboardingStep,
} from '@/modules/shared/hooks/__fixtures__/venue-onboarding'
import type {
  PortfolioReader,
  PortfolioSnapshot,
  Unsubscribe,
  Venue,
} from '@/modules/shared/domain'
import { SelectedWalletBalancesPanel } from '../SelectedWalletBalancesPanel'

function makePortfolioReader(accountValue: number): PortfolioReader {
  return {
    subscribeSnapshot(_scope, onUpdate): Unsubscribe {
      onUpdate({ accountValue, perpsEquity: accountValue } as PortfolioSnapshot)
      return () => undefined
    },
    getHistory() {
      throw new Error('not used')
    },
  } as PortfolioReader
}

function makeVenue(
  onboardingReady: boolean,
  accountValue: number,
  metadata: { id: string; label: string } = { id: 'hyperliquid', label: 'Hyperliquid' },
): Venue {
  return {
    metadata,
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      portfolio: makePortfolioReader(accountValue),
    },
    onboarding: {
      provider: ({ children }: { children: ReactNode }) => <>{children}</>,
      useVenueOnboarding: () =>
        makeVenueOnboarding({
          status: onboardingReady ? 'ready' : 'incomplete',
          steps: [makeOnboardingStep({ status: onboardingReady ? 'complete' : 'pending' })],
        }),
    },
  } as Venue
}

function wrap(venue: Venue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VenueProvider venue={venue}>
        <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
      </VenueProvider>
    )
  }
}

describe('<SelectedWalletBalancesPanel />', () => {
  it('renders one line per integrated venue with the equity for an onboarded venue', () => {
    render(<SelectedWalletBalancesPanel />, { wrapper: wrap(makeVenue(true, 2500)) })
    const row = screen.getByTestId('venue-balance-hyperliquid')
    expect(row).toHaveTextContent('Hyperliquid')
    expect(row).toHaveTextContent('$2,500.00')
  })

  it('renders the real venue icon for an integrated venue (id carries a :network suffix)', () => {
    // The runtime HL venue id is `hyperliquid:mainnet`, not the bare `hyperliquid`
    // — the icon must resolve by the base id before the colon.
    render(<SelectedWalletBalancesPanel />, {
      wrapper: wrap(makeVenue(true, 2500, { id: 'hyperliquid:mainnet', label: 'Hyperliquid' })),
    })
    const row = screen.getByTestId('venue-balance-hyperliquid:mainnet')
    const icon = row.querySelector('img')
    expect(icon).not.toBeNull()
    expect(icon?.getAttribute('src')).toContain('hyperliquid')
  })

  it('falls back to the first-char monogram for a venue with no icon', () => {
    render(<SelectedWalletBalancesPanel />, {
      wrapper: wrap(makeVenue(true, 0, { id: 'mock', label: 'Mock' })),
    })
    const row = screen.getByTestId('venue-balance-mock')
    expect(row.querySelector('img')).toBeNull()
    expect(row).toHaveTextContent('M')
  })

  it('shows the Onboard link (not $ value) when the venue is not onboarded', () => {
    render(<SelectedWalletBalancesPanel />, { wrapper: wrap(makeVenue(false, 2500)) })
    expect(screen.getByTestId('venue-onboard-hyperliquid')).toBeInTheDocument()
  })

  it('Onboard opens the venue-onboarding sheet', async () => {
    const user = userEvent.setup()
    let isOpen = false
    function Probe() {
      isOpen = useVenueOnboardingSheet().isOpen
      return <SelectedWalletBalancesPanel />
    }
    render(<Probe />, { wrapper: wrap(makeVenue(false, 0)) })
    await user.click(screen.getByTestId('venue-onboard-hyperliquid'))
    expect(isOpen).toBe(true)
  })
})
