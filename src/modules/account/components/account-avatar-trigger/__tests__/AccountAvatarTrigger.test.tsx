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
import { AccountAvatarTrigger } from '../AccountAvatarTrigger'

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

function wrap(flow: OnboardingState, open = vi.fn()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={baseAuth}>
      <OnboardingFlowContext.Provider value={flow}>
        <AccountModalContext.Provider value={{ isOpen: false, open, close: () => {} }}>
          {children}
        </AccountModalContext.Provider>
      </OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
  return { Wrapper, open }
}

describe('<AccountAvatarTrigger />', () => {
  it('shows the handle and a distinct account icon (not the wallet gradient)', () => {
    const { Wrapper } = wrap(readyFlow)
    render(<AccountAvatarTrigger />, { wrapper: Wrapper })
    expect(screen.getByTestId('account-avatar-handle')).toHaveTextContent('satoshi')
    expect(screen.getByTestId('account-avatar-icon')).toBeInTheDocument()
    expect(screen.queryByTestId('web3-avatar')).not.toBeInTheDocument()
  })

  it('opens the Account Modal on click', async () => {
    const user = userEvent.setup()
    const { Wrapper, open } = wrap(readyFlow)
    render(<AccountAvatarTrigger />, { wrapper: Wrapper })
    await user.click(screen.getByTestId('account-avatar-trigger'))
    expect(open).toHaveBeenCalledOnce()
  })

  it('shows a loading skeleton (not the button) while the flow is resolving', () => {
    const { Wrapper } = wrap({ kind: 'resolving' })
    render(<AccountAvatarTrigger />, { wrapper: Wrapper })
    expect(screen.getByTestId('account-avatar-skeleton')).toBeInTheDocument()
    expect(screen.queryByTestId('account-avatar-trigger')).not.toBeInTheDocument()
    expect(screen.queryByTestId('account-avatar-handle')).not.toBeInTheDocument()
  })

  it('renders nothing when the resolved account has no Native wallet', () => {
    const noNativeFlow: OnboardingState = {
      kind: 'ready',
      me: {
        user: { privyId: 'did:privy:abc', email: 'a@b.com', handle: 'satoshi', iconUrl: null },
        wallets: [],
      },
    }
    const { Wrapper } = wrap(noNativeFlow)
    const { container } = render(<AccountAvatarTrigger />, { wrapper: Wrapper })
    expect(container).toBeEmptyDOMElement()
  })
})
