import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { PortfolioTileColumn } from '../PortfolioTileColumn'
import type { Venue } from '@/modules/shared/domain'

const baseAuthState: AuthState = {
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

const minimalVenue: Venue = {
  metadata: { id: 'mock', label: 'Mock' },
  capabilities: {
    connection: { status: () => 'connected', subscribe: () => () => {} },
  },
}

function makeWrapper(venue: Venue = minimalVenue, auth: Partial<AuthState> = {}) {
  const authValue = { ...baseAuthState, ...auth }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueContext.Provider value={venue}>{children}</VenueContext.Provider>
    </AuthContext.Provider>
  )
}

describe('PortfolioTileColumn', () => {
  it('renders the 14 Day Volume tile', () => {
    render(<PortfolioTileColumn />, { wrapper: makeWrapper() })
    expect(screen.getByLabelText(/14 day volume/i)).toBeInTheDocument()
  })

  it('renders the Fees tile', () => {
    render(<PortfolioTileColumn />, { wrapper: makeWrapper() })
    expect(screen.getByLabelText(/fees/i)).toBeInTheDocument()
  })
})
