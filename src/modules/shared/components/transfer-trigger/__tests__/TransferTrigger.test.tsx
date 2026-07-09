import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import type { Venue } from '@/modules/shared/domain'
import { VenueProvider } from '../../../providers/venue-provider'
import { TransferSheetProvider } from '../../../providers/transfer-sheet-provider'
import { TransferTrigger } from '../TransferTrigger'
import {
  buildVenueWithTransfer,
  buildVenueWithoutTransfer,
  wrapWithTransferVenue,
} from '../../transfer-sheet/__fixtures__/fake-transfer-venue'

const connectedAuth: AuthState = {
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

function wrapConnected(venue: Venue, auth: Partial<AuthState> = {}) {
  const authValue = { ...connectedAuth, ...auth }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueProvider venue={venue}>
        <TransferSheetProvider>{children}</TransferSheetProvider>
      </VenueProvider>
    </AuthContext.Provider>
  )
}

describe('TransferTrigger', () => {
  it('renders nothing when the active venue has no transfer capability', () => {
    // No AuthProvider: a venue without `transfer` must short-circuit to null
    // before reaching the wallet gate, proving the capability gate runs first.
    const wrapper = wrapWithTransferVenue({ venue: buildVenueWithoutTransfer() })
    const { container } = render(<TransferTrigger />, { wrapper })

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing when the account is not segregated (unified)', () => {
    const wrapper = wrapWithTransferVenue({
      venue: buildVenueWithTransfer({ isSegregated: false }),
    })
    const { container } = render(<TransferTrigger />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the wallet is disconnected', () => {
    const wrapper = wrapConnected(buildVenueWithTransfer({ isSegregated: true }), {
      authenticated: false,
    })
    const { container } = render(<TransferTrigger />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the Transfer button when connected, segregated, and the capability exists', () => {
    const wrapper = wrapConnected(buildVenueWithTransfer({ isSegregated: true }))
    render(<TransferTrigger />, { wrapper })

    expect(screen.getByRole('button', { name: 'Transfer' })).toBeInTheDocument()
  })
})
