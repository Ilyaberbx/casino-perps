import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '@/modules/account'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { createApiClient } from '@/modules/shared/http'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import {
  TransferSheetProvider,
  useTransferSheet,
} from '@/modules/shared/providers/transfer-sheet-provider'
import type { TransferPrefill } from '@/modules/shared/providers/transfer-sheet-provider'
import type {
  Venue,
  BalancesReader,
  Balance,
  ConnectionStatusSource,
  AccountModeReader,
  VenueTransferCapability,
} from '@/modules/shared/domain'
import { BalancesPanel } from '../BalancesPanel'

const FAKE_SPOT_BALANCES: ReadonlyArray<Balance> = [
  { asset: 'USDC', amount: 5000, available: 5000, amountUsd: 5000, pnlPct: null, source: 'spot' },
  { asset: 'BTC', amount: 0.05, available: 0.05, amountUsd: 3000, pnlPct: 12.4, source: 'spot' },
  { asset: 'ETH', amount: 0.001, available: 0.001, amountUsd: 1, pnlPct: null, source: 'spot' },
]

const FAKE_PERPS_BALANCES: ReadonlyArray<Balance> = [
  { asset: 'USDC', amount: 100, available: 100, amountUsd: 100, pnlPct: 3.2, source: 'perps' },
]

const FAKE_UNIFIED_BALANCES: ReadonlyArray<Balance> = [
  { asset: 'USDC', amount: 5000, available: 4800, amountUsd: 5000, pnlPct: null, source: 'unified' },
  { asset: 'BTC', amount: 0.05, available: 0.05, amountUsd: 3000, pnlPct: null, source: 'unified' },
]

function makeBalancesReader(
  spot: ReadonlyArray<Balance> = FAKE_SPOT_BALANCES,
  perps: ReadonlyArray<Balance> = FAKE_PERPS_BALANCES,
): BalancesReader {
  return {
    subscribe(scope, onUpdate) {
      onUpdate(scope === 'perps' ? perps : spot)
      return () => {}
    },
  }
}

function makeAccountModeReader(isSegregated: boolean): AccountModeReader {
  return {
    current: () => ({ isSegregated }),
    subscribe(onChange) {
      onChange({ isSegregated })
      return () => {}
    },
  }
}

function makeConnectionSource(): ConnectionStatusSource {
  return {
    status: () => 'connected',
    subscribe: (onChange) => {
      onChange('connected')
      return () => {}
    },
  }
}

function makeTransferCapability(): VenueTransferCapability {
  return {
    provider: ({ children }: { children: ReactNode }) => <>{children}</>,
    body: () => <div data-testid="transfer-body" />,
    useTransfer: () => ({ isApplicable: true, isComplete: false }),
  }
}

interface MakeVenueOptions {
  readonly balancesReader?: BalancesReader
  readonly accountMode?: AccountModeReader
  readonly withTransfer?: boolean
}

function makeVenue(
  balancesReader?: BalancesReader,
  accountMode?: AccountModeReader,
  options: Pick<MakeVenueOptions, 'withTransfer'> = {},
): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: makeConnectionSource(),
      balances: balancesReader,
      accountMode,
    },
    transfer: options.withTransfer ? makeTransferCapability() : undefined,
  }
}

const connectedState: AuthState = {
  ready: true,
  authenticated: true,
  privyId: 'did:privy:abc',
  walletAddress: '0xaaaa000000000000000000000000000000000001',
  primaryWalletAddress: null,
  walletSource: 'embedded',
  walletReady: true,
  isBroadcastWalletReady: true,
  connectableMasterAddresses: [],
  externalWallets: [],
  hasMfa: false,
  enrollMfa: () => okAsync(undefined),
  getAccessToken: async () => 'jwt',
  logout: async () => {},
  loginWithWallet: () => okAsync(undefined),
  linkWallet: () => okAsync("0x0000000000000000000000000000000000000000"),
  openConnectModal: () => {},
  closeConnectModal: () => {},
  isConnectModalOpen: false,
  exportableAddresses: [],
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  apiClient: createApiClient({ getAccessToken: async () => 'jwt' }),
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  getAgentWalletBroadcastClient: async () => null,
  switchMasterWalletChain: async () => 'switched',
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
}

function makeWrapper(authOverrides: Partial<AuthState>, venue: Venue) {
  const authValue = { ...connectedState, ...authOverrides }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueContext.Provider value={venue}>
        <TransferSheetProvider>{children}</TransferSheetProvider>
      </VenueContext.Provider>
    </AuthContext.Provider>
  )
}

/**
 * Probe consumer that mirrors the transfer-sheet state into the DOM so a UI test
 * can assert `open(...)` was called with the expected prefill without reaching
 * into provider internals.
 */
function SheetStateProbe() {
  const { isOpen, prefill } = useTransferSheet()
  const prefillLabel = (p: TransferPrefill | null) => (p ? p.from : 'none')
  return (
    <div data-testid="sheet-open">{`${isOpen ? 'open' : 'closed'}:${prefillLabel(prefill)}`}</div>
  )
}

const getTransferButtons = () => screen.queryAllByRole('button', { name: /^transfer$/i })

describe('BalancesPanel (trading account dock)', () => {
  it('renders balance rows when wallet is connected and balances capability present', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getAllByText('USDC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })

  it('tags each balance row with its source wallet (Spot / Perps)', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getAllByLabelText(/spot wallet/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByLabelText(/perps wallet/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders zero-USD spot balances by default (they only disappear with Hide Small Balances on)', () => {
    const ZERO_BALANCES: ReadonlyArray<Balance> = [
      { asset: 'USDH', amount: 0, available: 0, amountUsd: 0, pnlPct: null, source: 'spot' },
    ]
    const venue = makeVenue(makeBalancesReader(ZERO_BALANCES, []))
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getByText('USDH')).toBeInTheDocument()
  })

  it('aggregates spot + perps rows into a single row per asset when Aggregate Balances is on', async () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    // Off: USDC appears twice (spot + perps).
    expect(screen.getAllByText('USDC')).toHaveLength(2)
    const aggregate = screen.getByRole('checkbox', { name: /aggregate balances/i })
    await userEvent.click(aggregate)
    // On: USDC collapses into one aggregated row.
    expect(screen.getAllByText('USDC')).toHaveLength(1)
    expect(screen.getAllByLabelText(/all wallet/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders column headers when connected', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getByText(/asset/i)).toBeInTheDocument()
    expect(screen.getByText(/total balance/i)).toBeInTheDocument()
    expect(screen.getByText(/available balance/i)).toBeInTheDocument()
    expect(screen.getByText(/value.*usd/i)).toBeInTheDocument()
  })

  it('renders Aggregate Balances and Hide Small Balances toggles', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getByRole('checkbox', { name: /aggregate balances/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /hide small balances/i })).toBeInTheDocument()
  })

  it('filters out small balances when Hide Small Balances is toggled on', async () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    const hideSmall = screen.getByRole('checkbox', { name: /hide small balances/i })
    await userEvent.click(hideSmall)
    // ETH spot ($1) is below the threshold and disappears; the perps row
    // ($100) and the big spot rows remain.
    expect(screen.queryByText('ETH')).not.toBeInTheDocument()
    expect(screen.getAllByText('USDC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('shows unsupported message when the venue does not advertise balances', () => {
    const venue = makeVenue(undefined)
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.getByText(/balances not supported by this venue/i)).toBeInTheDocument()
  })

  it('formats USD value with thousands grouping and 2 decimals', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    // USDC spot amountUsd = 5000 → "$5,000.00" (not raw "$5000").
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
  })

  it('omits the Actions column (Send/Transfer/Trade)', () => {
    const venue = makeVenue(makeBalancesReader())
    const wrapper = makeWrapper({}, venue)
    render(<BalancesPanel />, { wrapper })
    expect(screen.queryByText(/^actions$/i)).not.toBeInTheDocument()
  })

  describe('unified / portfolio-margin account', () => {
    it('renders unified-sourced rows with a Unified chip', () => {
      const reader = makeBalancesReader(FAKE_UNIFIED_BALANCES, [])
      const venue = makeVenue(reader, makeAccountModeReader(false))
      const wrapper = makeWrapper({}, venue)
      render(<BalancesPanel />, { wrapper })
      expect(screen.getAllByLabelText(/unified wallet/i).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/^unified$/i).length).toBeGreaterThanOrEqual(1)
    })

    it('hides the Aggregate Balances toggle but keeps Hide Small Balances', () => {
      const reader = makeBalancesReader(FAKE_UNIFIED_BALANCES, [])
      const venue = makeVenue(reader, makeAccountModeReader(false))
      const wrapper = makeWrapper({}, venue)
      render(<BalancesPanel />, { wrapper })
      expect(screen.queryByRole('checkbox', { name: /aggregate balances/i })).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /hide small balances/i })).toBeInTheDocument()
    })
  })

  describe('classic account (segregated accountMode)', () => {
    it('keeps the Aggregate Balances toggle when accountMode reports segregated', () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true))
      const wrapper = makeWrapper({}, venue)
      render(<BalancesPanel />, { wrapper })
      expect(screen.getByRole('checkbox', { name: /aggregate balances/i })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /hide small balances/i })).toBeInTheDocument()
    })
  })

  describe('per-row Transfer button (slice 05)', () => {
    function buildSpectate(overrides: Partial<SpectateContextValue> = {}): SpectateContextValue {
      return {
        spectatedAddress: null,
        isSpectating: false,
        startSpectating: () => {},
        stopSpectating: () => {},
        watchlist: [],
        addToWatchlist: () => {},
        removeFromWatchlist: () => {},
        isWatchlisted: () => false,
        ...overrides,
      }
    }

    function renderWithProbe(
      venue: Venue,
      authOverrides: Partial<AuthState> = {},
      spectate: SpectateContextValue = buildSpectate(),
    ) {
      const InnerWrapper = makeWrapper(authOverrides, venue)
      const wrapper = ({ children }: { children: ReactNode }) => (
        <SpectateContext.Provider value={spectate}>
          <InnerWrapper>{children}</InnerWrapper>
        </SpectateContext.Provider>
      )
      render(
        <>
          <BalancesPanel />
          <SheetStateProbe />
        </>,
        { wrapper },
      )
    }

    it('shows a Transfer button on USDC rows only (one per spot + perps USDC row)', () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue)
      // FAKE_SPOT_BALANCES has one USDC row; FAKE_PERPS_BALANCES one USDC row.
      // BTC / ETH are non-USDC and get no button.
      expect(getTransferButtons()).toHaveLength(2)
    })

    it('opens From Spot (Spot→Perp) when the spot USDC row button is clicked', async () => {
      const spot: ReadonlyArray<Balance> = [
        { asset: 'USDC', amount: 5000, available: 5000, amountUsd: 5000, pnlPct: null, source: 'spot' },
      ]
      const venue = makeVenue(makeBalancesReader(spot, []), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue)
      expect(screen.getByTestId('sheet-open')).toHaveTextContent('closed:none')
      await userEvent.click(getTransferButtons()[0])
      expect(screen.getByTestId('sheet-open')).toHaveTextContent('open:spot')
    })

    it('opens From Perp (Perp→Spot) when the perps USDC row button is clicked', async () => {
      const perps: ReadonlyArray<Balance> = [
        { asset: 'USDC', amount: 100, available: 100, amountUsd: 100, pnlPct: null, source: 'perps' },
      ]
      const venue = makeVenue(makeBalancesReader([], perps), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue)
      await userEvent.click(getTransferButtons()[0])
      expect(screen.getByTestId('sheet-open')).toHaveTextContent('open:perps')
    })

    it('opens with the default direction (no prefill) for an aggregated USDC row', async () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue)
      await userEvent.click(screen.getByRole('checkbox', { name: /aggregate balances/i }))
      // After aggregation USDC collapses to one row with source 'aggregated'.
      expect(getTransferButtons()).toHaveLength(1)
      await userEvent.click(getTransferButtons()[0])
      expect(screen.getByTestId('sheet-open')).toHaveTextContent('open:none')
    })

    it('renders no Transfer button when the wallet is disconnected', () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue, { authenticated: false, walletAddress: null })
      expect(getTransferButtons()).toHaveLength(0)
    })

    it('renders no Transfer button when the venue lacks the transfer capability', () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true), {
        withTransfer: false,
      })
      renderWithProbe(venue)
      expect(getTransferButtons()).toHaveLength(0)
    })

    it('renders no Transfer button for a unified account (not segregated)', () => {
      const reader = makeBalancesReader(FAKE_UNIFIED_BALANCES, [])
      const venue = makeVenue(reader, makeAccountModeReader(false), { withTransfer: true })
      renderWithProbe(venue)
      expect(getTransferButtons()).toHaveLength(0)
    })

    it('renders no Transfer button while spectating (the row is someone else’s account)', () => {
      const venue = makeVenue(makeBalancesReader(), makeAccountModeReader(true), {
        withTransfer: true,
      })
      renderWithProbe(venue, {}, buildSpectate({ isSpectating: true }))
      expect(getTransferButtons()).toHaveLength(0)
    })
  })
})
