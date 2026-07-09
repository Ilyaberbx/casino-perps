import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { okAsync } from 'neverthrow'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { VenueContext } from '../../../../shared/providers/venue-provider/venue-provider.context'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import { LeverageMarginProvider } from '../../../providers/leverage-margin'
import { OrderIntentProvider } from '../../../providers/order-intent-provider'
import { SpectateContext } from '@/modules/spectate/providers/spectate-provider/spectate-provider.context'
import type { SpectateContextValue } from '@/modules/spectate'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { VenueOnboardingProvider } from '@/modules/shared/providers/venue-onboarding-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import type {
  PlaceOrderRequest,
  PortfolioReader,
  PortfolioSnapshot,
  Trader,
  Venue,
} from '../../../../shared/domain'
import { OrderEntry } from '../OrderEntry'
import { buildFakeOrderValidation } from '../__fixtures__/fake-order-validation'

const CONNECTED_AUTH: AuthState = {
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

function buildVenueWithoutTrader(): Venue {
  return {
    metadata: { id: 'hyperliquid:mainnet', label: 'Hyperliquid' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      // No `trader` capability — this is the Hyperliquid read-only case.
    },
  }
}

function buildPortfolio(accountValue: number): PortfolioReader {
  const snapshot: PortfolioSnapshot = {
    accountValue,
    pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    perpsPnl: 0,
    volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
    spotEquity: 0,
    perpsEquity: accountValue,
    fourteenDayVolume: 0,
    timestamp: 0,
  }
  return {
    subscribeSnapshot: (_scope, onUpdate) => {
      onUpdate(snapshot)
      return () => {}
    },
    getHistory: () => okAsync([]),
  }
}

function buildVenueWithTrader(
  options: {
    accountValue?: number
    supportsStopOrders?: boolean
    placeOrder?: Trader['placeOrder']
  } = {},
): Venue {
  const hasPortfolio = options.accountValue !== undefined
  const placeOrder: Trader['placeOrder'] =
    options.placeOrder ??
    (() =>
      okAsync({
        kind: 'filled' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        averagePrice: 60_000,
        filledSize: 1,
        timestamp: 1,
      }))
  const validation = buildFakeOrderValidation({
    symbol: 'BTC-PERP',
    markPrice: 0,
    availableMargin: options.accountValue ?? 0,
  })
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      trader: {
        placeOrder,
        cancelOrder: () => okAsync(undefined),
        validateDraft: validation.validateDraft,
        previewOrder: validation.previewOrder,
        ...(options.supportsStopOrders ? { supportsStopOrders: true } : {}),
      },
      ...(hasPortfolio ? { portfolio: buildPortfolio(options.accountValue!) } : {}),
    },
  }
}

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

function Wrap({
  venue,
  spectate = buildSpectate(),
  children,
}: {
  venue: Venue
  spectate?: SpectateContextValue
  children: ReactNode
}) {
  return (
    <MemoryRouter>
      <AuthContext.Provider value={CONNECTED_AUTH}>
        <SpectateContext.Provider value={spectate}>
          <VenueContext.Provider value={venue}>
            <VenueOnboardingSheetProvider>
            <VenueOnboardingProvider value={null}>
            <SelectedMarketContext.Provider
            value={{
              selectedMarket: 'BTC-PERP',
              setSelectedMarket: () => {},
              market: {
                symbol: 'BTC-PERP',
                baseAsset: 'BTC',
                quoteAsset: 'USD',
                venue: 'mock',
                tickSize: 0.5,
                stepSize: 0.001,
                marketType: 'perp',
                hlCoin: 'BTC',
              },
            }}
          >
              <LeverageMarginProvider>
                <OrderIntentProvider>{children}</OrderIntentProvider>
              </LeverageMarginProvider>
            </SelectedMarketContext.Provider>
            </VenueOnboardingProvider>
            </VenueOnboardingSheetProvider>
          </VenueContext.Provider>
        </SpectateContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('OrderEntry', () => {
  it('renders a read-only placeholder when the venue exposes no trader capability', () => {
    const venue = buildVenueWithoutTrader()
    render(
      <Wrap venue={venue}>
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })

  it('leads the panel with the Long/Short toggle and renders no in-panel header', () => {
    const { container } = render(
      <Wrap venue={buildVenueWithTrader()}>
        <OrderEntry />
      </Wrap>,
    )
    // No in-panel symbol/"Order entry" header — the reference panel has none.
    expect(screen.queryByText(/order entry/i)).not.toBeInTheDocument()
    // SideToggle (the "Order side" group) is the first control in the panel.
    const panel = container.firstElementChild
    const sideGroup = screen.getByRole('group', { name: /order side/i })
    expect(panel?.firstElementChild).toContainElement(sideGroup)
  })

  it('shows the submit button (not Stop Spectating) when not spectating', () => {
    render(
      <Wrap venue={buildVenueWithTrader()}>
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.queryByRole('button', { name: /stop spectating/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })

  it('swaps the submit button for a Stop Spectating button while spectating', () => {
    render(
      <Wrap venue={buildVenueWithTrader()} spectate={buildSpectate({ isSpectating: true })}>
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.getByRole('button', { name: /stop spectating/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  // ADR-0027 acceptance criterion 3: onboarding-ready but perp accountValue == 0
  // is a clear Tradeable Funds gate, not an opaque venue rejection.
  it('gates the submit with "Deposit to trade" when perp accountValue is 0', () => {
    render(
      <Wrap venue={buildVenueWithTrader({ accountValue: 0 })}>
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.getByRole('button', { name: /deposit to trade/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  })

  // ADR-0027 acceptance criterion 5: accountValue > 0 enables the live submit.
  it('renders the submit button when perp accountValue is positive', () => {
    render(
      <Wrap venue={buildVenueWithTrader({ accountValue: 5_000 })}>
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deposit to trade/i })).not.toBeInTheDocument()
  })

  // ADR-0027 acceptance criterion 4 / D-4: spectating a funded address while the
  // submit stack is hidden must never un-gate. The funds gate only mounts in the
  // non-spectating branch, so a funded Spectated Address Snapshot can't leak in.
  it('keeps the submit gated (Stop Spectating shown) when spectating a funded address', () => {
    render(
      <Wrap
        venue={buildVenueWithTrader({ accountValue: 1_000_000 })}
        spectate={buildSpectate({ isSpectating: true })}
      >
        <OrderEntry />
      </Wrap>,
    )
    expect(screen.getByRole('button', { name: /stop spectating/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deposit to trade/i })).not.toBeInTheDocument()
  })

  async function selectStopMarket(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /^pro/i }))
    await user.click(screen.getByRole('option', { name: 'Stop Market' }))
  }

  async function selectStopLimit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /^pro/i }))
    await user.click(screen.getByRole('option', { name: 'Stop Limit' }))
  }

  it('renders the Stop Market field set (Stop Price, no TP/SL) when Stop Market is selected', async () => {
    const user = userEvent.setup()
    render(
      <Wrap venue={buildVenueWithTrader({ accountValue: 5_000, supportsStopOrders: true })}>
        <OrderEntry />
      </Wrap>,
    )
    await selectStopMarket(user)
    expect(screen.getByLabelText('Stop Price')).toBeInTheDocument()
    // Stop types never render the entry TP/SL section nor a Limit price field.
    expect(screen.queryByLabelText('Limit price')).not.toBeInTheDocument()
    expect(screen.queryByText(/take profit/i)).not.toBeInTheDocument()
    // Footer is the linear set: Order Value, Margin Required, Fees — no liq / slippage row.
    expect(screen.getByText('Order Value')).toBeInTheDocument()
    expect(screen.getByText('Margin Required')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.queryByText('Liquidation Price')).not.toBeInTheDocument()
    expect(screen.queryByText('Slippage')).not.toBeInTheDocument()
  })

  it('routes a Stop Market submission to placeOrder with the stop price', async () => {
    const user = userEvent.setup()
    const placeOrder = vi.fn<Trader['placeOrder']>(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    render(
      <Wrap
        venue={buildVenueWithTrader({ accountValue: 5_000, supportsStopOrders: true, placeOrder })}
      >
        <OrderEntry />
      </Wrap>,
    )
    await selectStopMarket(user)
    await user.type(screen.getByLabelText('Stop Price'), '65000')
    await user.type(screen.getByLabelText('Order size'), '2')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /submit/i }))
    })
    const request = placeOrder.mock.calls[0]?.[0] as PlaceOrderRequest
    expect(request.orderType).toBe('stop-market')
    expect(request).toMatchObject({ orderType: 'stop-market', stopPrice: 65000, size: 2 })
  })

  it('renders the Stop Limit two-field set (Stop Price + Limit price, no TP/SL) when Stop Limit is selected', async () => {
    const user = userEvent.setup()
    render(
      <Wrap venue={buildVenueWithTrader({ accountValue: 5_000, supportsStopOrders: true })}>
        <OrderEntry />
      </Wrap>,
    )
    await selectStopLimit(user)
    // Both price fields render together — the tallest stop block (IA stress layout).
    expect(screen.getByLabelText('Stop Price')).toBeInTheDocument()
    expect(screen.getByLabelText('Limit price')).toBeInTheDocument()
    // Stop types never render the entry TP/SL section.
    expect(screen.queryByText(/take profit/i)).not.toBeInTheDocument()
    // Footer is the linear set: Order Value, Margin Required, Fees — no liq / slippage row.
    expect(screen.getByText('Order Value')).toBeInTheDocument()
    expect(screen.getByText('Margin Required')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
    expect(screen.queryByText('Liquidation Price')).not.toBeInTheDocument()
    expect(screen.queryByText('Slippage')).not.toBeInTheDocument()
  })

  it('keeps the submit disabled until both stop and limit price are entered (Stop Limit)', async () => {
    const user = userEvent.setup()
    render(
      <Wrap venue={buildVenueWithTrader({ accountValue: 5_000, supportsStopOrders: true })}>
        <OrderEntry />
      </Wrap>,
    )
    await selectStopLimit(user)
    const submitButton = screen.getByRole('button', { name: /submit/i })
    // Size + stop only — limit price still missing → gated.
    await user.type(screen.getByLabelText('Order size'), '2')
    await user.type(screen.getByLabelText('Stop Price'), '65000')
    expect(submitButton).toBeDisabled()
    // Adding the limit price satisfies the stop-limit matrix → enabled.
    await user.type(screen.getByLabelText('Limit price'), '64900')
    expect(submitButton).toBeEnabled()
  })

  it('routes a Stop Limit submission to placeOrder with both prices', async () => {
    const user = userEvent.setup()
    const placeOrder = vi.fn<Trader['placeOrder']>(() =>
      okAsync({
        kind: 'resting' as const,
        orderIdentifier: 'o1',
        symbol: 'BTC-PERP',
        timestamp: 1,
      }),
    )
    render(
      <Wrap
        venue={buildVenueWithTrader({ accountValue: 5_000, supportsStopOrders: true, placeOrder })}
      >
        <OrderEntry />
      </Wrap>,
    )
    await selectStopLimit(user)
    await user.type(screen.getByLabelText('Stop Price'), '65000')
    await user.type(screen.getByLabelText('Limit price'), '64900')
    await user.type(screen.getByLabelText('Order size'), '2')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /submit/i }))
    })
    const request = placeOrder.mock.calls[0]?.[0] as PlaceOrderRequest
    expect(request).toMatchObject({
      orderType: 'stop-limit',
      stopPrice: 65000,
      price: 64900,
      size: 2,
    })
  })
})
