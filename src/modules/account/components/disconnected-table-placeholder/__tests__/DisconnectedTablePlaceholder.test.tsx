import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import { createApiClient } from '@/modules/shared/http'
import { DisconnectedTablePlaceholder } from '../DisconnectedTablePlaceholder'

const baseConnected: AuthState = {
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

function wrap(overrides: Partial<AuthState>) {
  const value = { ...baseConnected, ...overrides }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

describe('DisconnectedTablePlaceholder', () => {
  it('renders children when wallet is connected', () => {
    render(
      <DisconnectedTablePlaceholder message="Connect wallet to view positions">
        <span>positions table</span>
      </DisconnectedTablePlaceholder>,
      { wrapper: wrap({}) },
    )
    expect(screen.getByText('positions table')).toBeInTheDocument()
    expect(
      screen.queryByText('Connect wallet to view positions'),
    ).not.toBeInTheDocument()
  })

  it('renders the placeholder message when not connected', () => {
    render(
      <DisconnectedTablePlaceholder message="Connect wallet to view positions">
        <span>positions table</span>
      </DisconnectedTablePlaceholder>,
      { wrapper: wrap({ authenticated: false, walletReady: false }) },
    )
    expect(screen.queryByText('positions table')).not.toBeInTheDocument()
    expect(screen.getByText('Connect wallet to view positions')).toBeInTheDocument()
  })

  it('renders no button or CTA when disconnected (text only)', () => {
    render(
      <DisconnectedTablePlaceholder message="Connect wallet to view positions">
        <span>positions table</span>
      </DisconnectedTablePlaceholder>,
      { wrapper: wrap({ authenticated: false, walletReady: false }) },
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
