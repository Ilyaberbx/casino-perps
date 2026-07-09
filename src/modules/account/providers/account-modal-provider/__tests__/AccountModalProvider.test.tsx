import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthContext, type AuthState } from '../../auth-provider/auth-provider.context'
import { createApiClient } from '@/modules/shared/http'
import { AccountModalProvider } from '../AccountModalProvider'
import { useAccountModal } from '../use-account-modal'

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
  linkWallet: () => okAsync('0x0000000000000000000000000000000000000000'),
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

// Reads the modal state and exposes `open` as a button so a test can drive the
// provider through its real consumer hook rather than poking context internals.
function ModalProbe() {
  const { isOpen, open } = useAccountModal()
  return (
    <>
      <span data-testid="modal-state">{isOpen ? 'open' : 'closed'}</span>
      <button type="button" onClick={open}>
        open
      </button>
    </>
  )
}

function tree(auth: AuthState) {
  return (
    <AuthContext.Provider value={auth}>
      <AccountModalProvider>
        <ModalProbe />
      </AccountModalProvider>
    </AuthContext.Provider>
  )
}

describe('<AccountModalProvider />', () => {
  it('closes the modal when the user becomes unauthenticated (logout / session loss)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(tree(baseAuth))

    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByTestId('modal-state')).toHaveTextContent('open')

    rerender(tree({ ...baseAuth, authenticated: false }))

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed')
  })

  it('leaves open/close controls working while authenticated', async () => {
    const user = userEvent.setup()
    render(tree(baseAuth))

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed')
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByTestId('modal-state')).toHaveTextContent('open')
  })
})
