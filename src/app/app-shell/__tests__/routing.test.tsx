import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

// The casino app shell wires many app-level surfaces (social feed, trading
// search overlay, funding sheets). This suite exercises ROUTING + the shell's
// auth controls, so those heavy surfaces are stubbed — mirroring how the perps
// routing test stubbed the venue switcher and theme provider.

const { authRef, openConnectModalSpy } = vi.hoisted(() => ({
  authRef: { current: false },
  openConnectModalSpy: vi.fn(),
}))

vi.mock('@/modules/account', () => ({
  AccountModalProvider: ({ children }: { children: ReactNode }) => children,
  AccountModal: () => null,
  AccountAvatarTrigger: () => <div data-testid="account-avatar-trigger" />,
  useAuth: () => ({
    authenticated: authRef.current,
    openConnectModal: openConnectModalSpy,
    loginWithWallet: () => {},
  }),
  useIsWalletConnected: () => false,
}))

vi.mock('@/modules/social', () => ({
  LiveWinsTicker: () => <div data-testid="live-wins" />,
  ChatPanel: () => <div data-testid="chat-panel" />,
  DISCLOSURE_TEXT: 'Chat and Live Wins are simulated.',
}))

vi.mock('@/modules/trading', () => ({
  MobileBottomNav: () => <nav data-testid="mobile-bottom-nav" />,
  MarketSelectionWindow: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="search-overlay-open" /> : null,
}))

vi.mock('@/modules/shared/components/connection-banner', () => ({ ConnectionBanner: () => null }))
vi.mock('@/modules/shared/components/VenueOnboardingBanner', () => ({
  VenueOnboardingBanner: () => null,
}))
vi.mock('@/modules/shared/components/VenueOnboardingSheet', () => ({
  VenueOnboardingSheet: () => null,
}))
vi.mock('@/modules/shared/components/deposit-sheet', () => ({ DepositSheet: () => null }))
vi.mock('@/modules/shared/components/transfer-sheet', () => ({ TransferSheet: () => null }))
vi.mock('@/modules/shared/components/manage-funds-modal', () => ({ ManageFundsModal: () => null }))
vi.mock('@/modules/shared/components/settings-modal', () => ({ SettingsModal: () => null }))

const openDepositSpy = vi.fn()
vi.mock('@/modules/shared/providers/deposit-sheet-provider', () => ({
  useDepositSheet: () => ({ isOpen: false, open: openDepositSpy, close: () => {} }),
}))
vi.mock('@/modules/shared/providers/venue-onboarding-sheet-provider', () => ({
  useVenueOnboardingSheet: () => ({ isOpen: false, open: () => {}, close: () => {} }),
}))

import { AppShell } from '../AppShell'

function harness(initialPath: string) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>LOBBY_PAGE</div>} />
          <Route path="trade" element={<Navigate to="/trade/BTC-PERP" replace />} />
          <Route path="trade/:symbol" element={<div>TRADE_PAGE</div>} />
          <Route path="my-bets" element={<div>MY_BETS_PAGE</div>} />
        </Route>
        <Route path="*" element={<div>NO_MATCH</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AppShell casino routing', () => {
  beforeEach(() => {
    authRef.current = false
    vi.clearAllMocks()
  })

  it('renders the lobby at /', () => {
    render(harness('/'))
    expect(screen.getByText('LOBBY_PAGE')).toBeInTheDocument()
  })

  it('renders the trade screen at /trade/:symbol', () => {
    render(harness('/trade/BTC-PERP'))
    expect(screen.getByText('TRADE_PAGE')).toBeInTheDocument()
  })

  it('redirects bare /trade to the default market', () => {
    render(harness('/trade'))
    expect(screen.getByText('TRADE_PAGE')).toBeInTheDocument()
  })

  it('renders My Bets at /my-bets', () => {
    render(harness('/my-bets'))
    expect(screen.getByText('MY_BETS_PAGE')).toBeInTheDocument()
  })

  it('does not match an unknown route', () => {
    render(harness('/nope'))
    expect(screen.getByText('NO_MATCH')).toBeInTheDocument()
  })

  it('mounts the shell chrome (rail, live wins, chat, mobile nav)', () => {
    render(harness('/'))
    expect(screen.getByTestId('left-rail')).toBeInTheDocument()
    expect(screen.getByTestId('live-wins')).toBeInTheDocument()
    expect(screen.getByTestId('chat-column')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument()
  })

  it('shows Log In and Create Account when unauthenticated', () => {
    render(harness('/'))
    expect(screen.getByTestId('center-log-in')).toBeInTheDocument()
    expect(screen.getByTestId('center-create-account')).toBeInTheDocument()
    expect(screen.queryByTestId('account-avatar-trigger')).not.toBeInTheDocument()
  })

  it('shows the account avatar when authenticated', () => {
    authRef.current = true
    render(harness('/'))
    expect(screen.getByTestId('account-avatar-trigger')).toBeInTheDocument()
    expect(screen.queryByTestId('center-create-account')).not.toBeInTheDocument()
  })

  it('Create Account opens the Privy connect modal', async () => {
    render(harness('/'))
    await userEvent.click(screen.getByTestId('center-create-account'))
    expect(openConnectModalSpy).toHaveBeenCalledTimes(1)
  })

  it('the search magnifier opens the market-search overlay', async () => {
    render(harness('/'))
    expect(screen.queryByTestId('search-overlay-open')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('center-search-button'))
    expect(screen.getByTestId('search-overlay-open')).toBeInTheDocument()
  })

  it('the rail Add Cash button opens the deposit flow', async () => {
    render(harness('/'))
    await userEvent.click(screen.getByTestId('rail-add-cash'))
    expect(openDepositSpy).toHaveBeenCalledTimes(1)
  })
})
