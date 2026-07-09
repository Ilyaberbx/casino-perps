import { okAsync } from 'neverthrow'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider/onboarding-flow-provider.context'
import type { OnboardingState } from '../../../hooks/use-onboarding-flow'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import { AccountModalContext } from '../../../providers/account-modal-provider'
import { createApiClient } from '@/modules/shared/http'
import { FakeToastProvider } from '@/modules/shared/providers/toast-provider/__fixtures__/fake-toast-provider'
import { AgentBalanceSheetProvider } from '@/modules/agent-balance'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { makeVenue } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import { AccountModal } from '../AccountModal'

vi.mock('@/modules/shared/providers/theme-provider', () => ({
  useThemeContext: () => ({ theme: 'dark', toggleTheme: () => {} }),
}))

const logoutMock = vi.fn()

const baseAuth: AuthState = {
  ready: true,
  authenticated: true,
  privyId: 'did:privy:abc',
  walletAddress: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
  primaryWalletAddress: null,
  walletSource: 'embedded',
  walletReady: true,
  isBroadcastWalletReady: true,
  connectableMasterAddresses: [],
  externalWallets: [],
  hasMfa: false,
  getAccessToken: async () => 'jwt',
  logout: logoutMock,
  enrollMfa: () => okAsync(undefined),
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

const readyFlow: OnboardingState = {
  kind: 'ready',
  me: {
    user: { privyId: 'did:privy:abc', email: 'a@b.com', handle: 'satoshi', iconUrl: null },
    wallets: [
      {
        chain: 'ethereum',
        address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
        isSelected: true,
        source: 'embedded',
      },
    ],
  },
}

function wrap(auth: AuthState = baseAuth, flow: OnboardingState = readyFlow, isOpen = true) {
  // Slice 07: the Wallets section now hosts the per-DEX balance panel, which
  // reads the active venue + the onboarding sheet controller.
  const venue = makeVenue()
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <OnboardingFlowContext.Provider value={flow}>
        <AccountModalContext.Provider value={{ isOpen, open: () => {}, close: () => {} }}>
          <VenueProvider venue={venue}>
            <VenueOnboardingSheetProvider>
              <AgentBalanceSheetProvider>
                <FakeToastProvider>{children}</FakeToastProvider>
              </AgentBalanceSheetProvider>
            </VenueOnboardingSheetProvider>
          </VenueProvider>
        </AccountModalContext.Provider>
      </OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
}

describe('<AccountModal /> — shell', () => {
  it('does not render when closed', () => {
    render(<AccountModal />, { wrapper: wrap(baseAuth, readyFlow, false) })
    expect(screen.queryByTestId('account-modal')).not.toBeInTheDocument()
  })

  it('opens with the Profile section active by default', () => {
    render(<AccountModal />, { wrapper: wrap() })
    expect(screen.getByTestId('account-modal')).toBeInTheDocument()
    expect(screen.getByTestId('account-section-profile')).toBeInTheDocument()
    expect(screen.queryByTestId('account-section-mfa')).not.toBeInTheDocument()
  })

  it('navigates to the 2FA section when its nav item is clicked', async () => {
    const user = userEvent.setup()
    render(<AccountModal />, { wrapper: wrap() })
    await user.click(screen.getByTestId('account-nav-mfa'))
    expect(screen.getByTestId('account-section-mfa')).toBeInTheDocument()
    expect(screen.queryByTestId('account-section-profile')).not.toBeInTheDocument()
  })

  it('navigates to the Wallets placeholder section', async () => {
    const user = userEvent.setup()
    render(<AccountModal />, { wrapper: wrap() })
    await user.click(screen.getByTestId('account-nav-wallets'))
    expect(screen.getByTestId('account-section-wallets')).toBeInTheDocument()
  })
})

describe('<AccountModal /> — Profile section', () => {
  it('shows read-only email and handle', () => {
    render(<AccountModal />, { wrapper: wrap() })
    expect(screen.getByTestId('profile-email')).toHaveTextContent('a@b.com')
    expect(screen.getByTestId('profile-handle')).toHaveTextContent('satoshi')
  })

  it('renders the web3-avatar fallback when iconUrl is null', () => {
    render(<AccountModal />, { wrapper: wrap() })
    expect(screen.getByTestId('web3-avatar')).toHaveAttribute(
      'data-avatar-seed',
      '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
    )
  })

  it('logs out from the Profile footer', async () => {
    const user = userEvent.setup()
    logoutMock.mockReset()
    render(<AccountModal />, { wrapper: wrap() })
    await user.click(screen.getByTestId('profile-logout'))
    expect(logoutMock).toHaveBeenCalledOnce()
  })
})

describe('<AccountModal /> — 2FA section', () => {
  it('shows the enrol CTA when no 2FA is set, and calls enrollMfa', async () => {
    const user = userEvent.setup()
    const enroll = vi.fn(() => okAsync(undefined))
    const auth = { ...baseAuth, hasMfa: false, enrollMfa: enroll }
    render(<AccountModal />, { wrapper: wrap(auth) })
    await user.click(screen.getByTestId('account-nav-mfa'))
    await user.click(screen.getByTestId('mfa-setup'))
    expect(enroll).toHaveBeenCalledOnce()
  })

  it('shows the "on" state when 2FA is set', async () => {
    const user = userEvent.setup()
    const auth = { ...baseAuth, hasMfa: true }
    render(<AccountModal />, { wrapper: wrap(auth) })
    await user.click(screen.getByTestId('account-nav-mfa'))
    expect(screen.getByTestId('mfa-on')).toBeInTheDocument()
    expect(screen.queryByTestId('mfa-setup')).not.toBeInTheDocument()
  })
})
