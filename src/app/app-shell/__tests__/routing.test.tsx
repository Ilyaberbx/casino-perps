import { okAsync } from 'neverthrow'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  AuthContext,
  OnboardingFlowContext,
  type AuthState,
  type OnboardingState,
} from '@/modules/account'
import { AgentWalletContext } from '@/modules/hyperliquid'
import type { AgentWalletState } from '@/modules/hyperliquid'
import { createApiClient } from '@/modules/shared/http'
import { SpectateProvider } from '@/modules/spectate'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { DepositSheetProvider } from '@/modules/shared/providers/deposit-sheet-provider'
import { TransferSheetProvider } from '@/modules/shared/providers/transfer-sheet-provider'
import { ManageFundsProvider } from '@/modules/shared/providers/manage-funds-provider'
import { SettingsProvider } from '@/modules/shared/providers/settings-provider'
import { AgentBalanceSheetProvider } from '@/modules/agent-balance'
import { VenueOnboardingProvider } from '@/modules/shared/providers/venue-onboarding-provider'
import { AppShell } from '../AppShell'

vi.mock('@/modules/shared/providers/theme-provider', () => ({
  useThemeContext: () => ({ theme: 'dark', toggleTheme: () => {} }),
}))

vi.mock('@/modules/shared/providers/trading-mode-provider', () => ({
  useTradingMode: () => ({ mode: 'pro', setMode: () => {} }),
  // Pro/Simple surfaces (AgentWalletSurface, ManageFundsPills, equity/fees cards)
  // read this selector; the mock defaults the whole shell to Pro.
  useIsSimpleMode: () => false,
  // The settings-modal constants build the Pro/Simple toggle options from this
  // at module load, so the mock must export it too (not just the hook).
  TRADING_MODES: [
    { id: 'pro', label: 'Pro' },
    { id: 'simple', label: 'Simple' },
  ],
  DEFAULT_TRADING_MODE: 'pro',
}))

vi.mock('../../venue-switcher', () => ({
  VenueSwitcher: () => <div data-testid="venue-switcher" />,
}))

const baseAuth: AuthState = {
  ready: true,
  authenticated: false,
  privyId: null,
  walletAddress: null,
  primaryWalletAddress: null,
  walletSource: null,
  walletReady: false,
  isBroadcastWalletReady: false,
  connectableMasterAddresses: [],
  externalWallets: [],
  hasMfa: false,
  enrollMfa: () => okAsync(undefined),
  getAccessToken: async () => null,
  logout: async () => {},
  loginWithWallet: () => okAsync(undefined),
  linkWallet: () => okAsync("0x0000000000000000000000000000000000000000"),
  openConnectModal: () => {},
  closeConnectModal: () => {},
  isConnectModalOpen: false,
  exportableAddresses: [],
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  apiClient: createApiClient({ getAccessToken: async () => null }),
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  getAgentWalletBroadcastClient: async () => null,
  switchMasterWalletChain: async () => 'switched',
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
}

const idleFlow: OnboardingState = { kind: 'idle' }

const baseAgentState: AgentWalletState = {
  status: 'missing',
  agentAddress: null,
  existingAgents: null,
  approve: () => okAsync(undefined),
  getSigningWallet: () => null,
}

function harness({
  initialPath,
  auth,
  flow,
}: {
  initialPath: string
  auth: AuthState
  flow: OnboardingState
}) {
  const Providers = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <OnboardingFlowContext.Provider value={flow}>
        <AgentWalletContext.Provider value={baseAgentState}>
          <VenueOnboardingSheetProvider>
            <AgentBalanceSheetProvider>
              <DepositSheetProvider>
                <TransferSheetProvider>
                  <ManageFundsProvider>
                    <SettingsProvider>
                      <VenueOnboardingProvider value={null}>{children}</VenueOnboardingProvider>
                    </SettingsProvider>
                  </ManageFundsProvider>
                </TransferSheetProvider>
              </DepositSheetProvider>
            </AgentBalanceSheetProvider>
          </VenueOnboardingSheetProvider>
        </AgentWalletContext.Provider>
      </OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
  return (
    <Providers>
      <MemoryRouter initialEntries={[initialPath]}>
        <SpectateProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/trade" element={<div>TRADE_PAGE</div>} />
              <Route path="/portfolio" element={<div>PORTFOLIO_PAGE</div>} />
            </Route>
            <Route path="*" element={<div>NO_MATCH</div>} />
          </Routes>
        </SpectateProvider>
      </MemoryRouter>
    </Providers>
  )
}

describe('AppShell open routing', () => {
  it('renders /trade for an unauthenticated visitor', () => {
    render(harness({ initialPath: '/trade', auth: baseAuth, flow: idleFlow }))
    expect(screen.getByText('TRADE_PAGE')).toBeInTheDocument()
  })

  it('renders /portfolio for an unauthenticated visitor', () => {
    render(harness({ initialPath: '/portfolio', auth: baseAuth, flow: idleFlow }))
    expect(screen.getByText('PORTFOLIO_PAGE')).toBeInTheDocument()
  })

  it('does not match /login (no such route)', () => {
    render(harness({ initialPath: '/login', auth: baseAuth, flow: idleFlow }))
    expect(screen.getByText('NO_MATCH')).toBeInTheDocument()
  })

  it('shows a Connect Wallet button in the header when not authenticated', () => {
    render(harness({ initialPath: '/trade', auth: baseAuth, flow: idleFlow }))
    expect(screen.getByTestId('connect-wallet-button')).toBeInTheDocument()
    expect(screen.queryByTestId('account-avatar-trigger')).not.toBeInTheDocument()
  })

  it('shows the account avatar trigger in the header when authenticated', () => {
    render(
      harness({
        initialPath: '/trade',
        auth: { ...baseAuth, authenticated: true, privyId: 'did:privy:x' },
        flow: {
          kind: 'ready',
          me: {
            user: {
              privyId: 'did:privy:x',
              email: 'x@b.com',
              handle: 'satoshi',
              iconUrl: null,
            },
            wallets: [
              {
                chain: 'ethereum',
                address: '0xaaaa000000000000000000000000000000000001',
                isSelected: true,
                source: 'embedded',
              },
            ],
          },
        },
      }),
    )
    expect(screen.getByTestId('account-avatar-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('connect-wallet-button')).not.toBeInTheDocument()
  })

  it('header nav preserves the spectate param while spectating', () => {
    const address = '0x1111111111111111111111111111111111111111'
    render(
      harness({
        initialPath: `/trade?spectate=${address}`,
        auth: baseAuth,
        flow: idleFlow,
      }),
    )
    expect(screen.getByRole('link', { name: 'Portfolio' }).getAttribute('href')).toBe(
      `/portfolio?spectate=${address}`,
    )
    expect(screen.getByRole('link', { name: 'Trade' }).getAttribute('href')).toBe(
      `/trade?spectate=${address}`,
    )
  })

  it('header nav links stay clean when not spectating', () => {
    render(harness({ initialPath: '/trade', auth: baseAuth, flow: idleFlow }))
    expect(screen.getByRole('link', { name: 'Portfolio' }).getAttribute('href')).toBe('/portfolio')
    expect(screen.getByRole('link', { name: 'Trade' }).getAttribute('href')).toBe('/trade')
  })

  it('clicking Connect Wallet calls openConnectModal()', async () => {
    const openConnectModal = vi.fn()
    render(
      harness({
        initialPath: '/trade',
        auth: { ...baseAuth, openConnectModal },
        flow: idleFlow,
      }),
    )
    screen.getByTestId('connect-wallet-button').click()
    expect(openConnectModal).toHaveBeenCalledTimes(1)
  })
})
