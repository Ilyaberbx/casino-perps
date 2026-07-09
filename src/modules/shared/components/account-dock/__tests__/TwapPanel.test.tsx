import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { ActiveTwap, Fill, TwapHistoryEntry, Venue } from '@/modules/shared/domain'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { SpectateProvider } from '@/modules/spectate'
import { TwapPanel } from '../TwapPanel'

const ACTIVE: ActiveTwap = {
  identifier: 'twap-active-1',
  symbol: 'BTC',
  side: 'buy',
  size: 10,
  executedSize: 2.5,
  executedNotionalUsd: 150_000,
  durationMinutes: 30,
  reduceOnly: false,
  randomize: false,
  createdAt: 1_700_000_000_000,
}

const HISTORY: TwapHistoryEntry = {
  identifier: 'twap-hist-1',
  symbol: 'ETH',
  side: 'sell',
  size: 10,
  executedSize: 7.5,
  executedNotionalUsd: 25_500,
  status: 'terminated',
  createdAt: 1_699_910_000_000,
  endedAt: 1_699_911_500_000,
  durationMinutes: 45,
  reduceOnly: true,
  randomize: false,
}

const SLICE_FILL: Fill = {
  identifier: '7-42',
  orderIdentifier: '1',
  symbol: 'SOL',
  side: 'buy',
  price: 145,
  size: 2,
  fee: 0.1,
  timestamp: 1_699_950_000_000,
  closedPnl: 0,
  direction: 'Open Long',
  crossed: true,
  feeToken: 'USDC',
}

function makeTwapVenue(): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      twapActiveSnapshot: {
        subscribe: (onUpdate) => {
          onUpdate([ACTIVE])
          return () => {}
        },
      },
      twapHistory: {
        subscribe: (onUpdate) => {
          onUpdate([HISTORY])
          return () => {}
        },
        loadOlder: () => okAsync({ exhausted: true }),
      },
      twapSliceFills: {
        subscribe: (onUpdate) => {
          onUpdate([SLICE_FILL])
          return () => {}
        },
        loadOlder: () => okAsync({ exhausted: true }),
      },
      twapController: {
        cancelTwap: () => okAsync(undefined),
        cancelAll: () => okAsync([]),
      },
    },
  }
}

const SPECTATED_ADDRESS = '0x1111111111111111111111111111111111111111'

// A connected (non-spectating) session: no `?spectate=` param. The venue mounts
// `twapController`, so the dock's `hasTwapController` resolves true → cancel
// affordances render.
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <VenueProvider venue={makeTwapVenue()}>
        <SpectateProvider>
          <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
        </SpectateProvider>
      </VenueProvider>
    </MemoryRouter>
  )
}

// A spectating session: the `?spectate=<addr>` URL override is honoured (the
// provider defaults `isWalletConnected` true), so `use-twap-panel`'s
// `hasTwapController = twapControllerCap !== undefined && !isSpectating` reads
// false even though the venue still mounts `twapController`. This exercises the
// real ADR-0038 preview-only lockout end-to-end, not a directly-passed prop.
function SpectatingProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={[`/?spectate=${SPECTATED_ADDRESS}`]}>
      <VenueProvider venue={makeTwapVenue()}>
        <SpectateProvider>
          <VenueOnboardingSheetProvider>{children}</VenueOnboardingSheetProvider>
        </SpectateProvider>
      </VenueProvider>
    </MemoryRouter>
  )
}

describe('TwapPanel — sub-tab switching', () => {
  it('renders the three sub-tabs and the Active panel by default', () => {
    render(<TwapPanel />, { wrapper: Providers })
    expect(screen.getByRole('tab', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Fill History' })).toBeInTheDocument()
    // Active panel-specific column header.
    expect(screen.getByText('Time Remaining')).toBeInTheDocument()
    // Active row renders the asset.
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('switches to the History sub-tab and renders completed TWAP rows', async () => {
    render(<TwapPanel />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('tab', { name: 'History' }))
    expect(screen.getByText('Reduce Only')).toBeInTheDocument()
    expect(screen.getByText('Terminated')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })

  it('switches to the Fill History sub-tab and renders slice fills', async () => {
    render(<TwapPanel />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('tab', { name: 'Fill History' }))
    expect(screen.getByText('Trade Value')).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
  })

  it('selecting a row reveals the bulk Cancel(N) affordance', async () => {
    render(<TwapPanel />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(
      screen.getByRole('button', { name: /cancel 1 selected twap orders/i }),
    ).toHaveTextContent('Cancel (1)')
  })

  it('opens the bulk confirm dialog from the Cancel(N) affordance', async () => {
    render(<TwapPanel />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /cancel 1 selected twap orders/i }))
    expect(screen.getByText(/cancel 1 selected twap order\?/i)).toBeInTheDocument()
  })
})

// Locks the ADR-0038 preview-only lockout: cancel affordances are driven by
// `use-twap-panel`'s `hasTwapController` (twapController mounted AND not
// spectating), not by a prop passed straight into the panel. These tests drive
// the gate through the real spectate provider so a regression that relaxes the
// lockout — or one that drops the controller wiring — fails here.
describe('TwapPanel — cancel affordance + spectate lockout (ADR-0038)', () => {
  it('renders the per-row Cancel and the select checkbox for the connected account', () => {
    render(<TwapPanel />, { wrapper: Providers })
    expect(screen.getByRole('button', { name: /cancel twap/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('reveals the bulk Cancel(N) affordance after selecting a row when connected', async () => {
    render(<TwapPanel />, { wrapper: Providers })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(
      screen.getByRole('button', { name: /cancel 1 selected twap orders/i }),
    ).toBeInTheDocument()
  })

  it('hides the per-row Cancel and the select checkbox while spectating', () => {
    render(<TwapPanel />, { wrapper: SpectatingProviders })
    // The Active row still renders (preview), but its write affordances are gone.
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancel twap/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('never exposes the bulk Cancel(N) affordance while spectating (no row to select)', () => {
    render(<TwapPanel />, { wrapper: SpectatingProviders })
    expect(
      screen.queryByRole('button', { name: /selected twap orders/i }),
    ).not.toBeInTheDocument()
  })
})
