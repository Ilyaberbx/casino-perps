import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import type { Venue, ConnectionStatus, ConnectionStatusSource, Unsubscribe } from '@/modules/shared/domain'
import { ConnectionStatusBar } from '../ConnectionStatusBar'
import type { WalletAddress } from '@/modules/shared/domain'

function makeControllableConnection(): {
  source: ConnectionStatusSource
  push: (status: ConnectionStatus) => void
} {
  let current: ConnectionStatus = 'connecting'
  const listeners = new Set<(status: ConnectionStatus) => void>()

  const source: ConnectionStatusSource = {
    status: () => current,
    subscribe(onChange): Unsubscribe {
      listeners.add(onChange)
      onChange(current)
      return () => {
        listeners.delete(onChange)
      }
    },
  }

  const push = (status: ConnectionStatus) => {
    current = status
    for (const listener of listeners) listener(status)
  }

  return { source, push }
}

function makeVenue(
  connectionSource: ConnectionStatusSource,
  metadata: { id: string; label: string } = { id: 'mock', label: 'Mock' },
): Venue {
  return {
    metadata,
    capabilities: { connection: connectionSource },
  }
}

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

function makeWrapper(authOverrides: Partial<AuthState>, venue: Venue) {
  const authValue = { ...baseAuthState, ...authOverrides }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueContext.Provider value={venue}>{children}</VenueContext.Provider>
    </AuthContext.Provider>
  )
}

describe('ConnectionStatusBar', () => {
  it('shows Mock network label for mock venue', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source, { id: 'mock', label: 'Mock' })
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText('Mock')).toBeInTheDocument()
  })

  it('shows Mainnet label for hyperliquid mainnet venue', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source, { id: 'hyperliquid:mainnet', label: 'Hyperliquid' })
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText('Mainnet')).toBeInTheDocument()
  })

  it('shows Testnet label for hyperliquid testnet venue', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source, { id: 'hyperliquid:testnet', label: 'Hyperliquid' })
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText('Testnet')).toBeInTheDocument()
  })

  it('shows "WebSockets" label', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText('WebSockets')).toBeInTheDocument()
  })

  it('shows "Wallet Disconnected" when wallet is not connected', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({ authenticated: false, walletReady: false }, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText(/wallet disconnected/i)).toBeInTheDocument()
  })

  it('shows last 5 chars of wallet address when connected', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source)
    const primaryWalletAddress = '0xaaaa000000000000000000000000000000000001' as WalletAddress
    const wrapper = makeWrapper({ primaryWalletAddress }, venue)
    render(<ConnectionStatusBar />, { wrapper })
    expect(screen.getByText('00001')).toBeInTheDocument()
  })

  it('dot has green indicator class on connected status', () => {
    const { source, push } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    act(() => push('connected'))
    const dot = screen.getByTestId('connection-dot')
    expect(dot).toHaveAttribute('data-status', 'connected')
  })

  it('dot has amber indicator class on connecting status', () => {
    const { source } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    const dot = screen.getByTestId('connection-dot')
    expect(dot).toHaveAttribute('data-status', 'connecting')
  })

  it('dot has amber indicator class on reconnecting status', () => {
    const { source, push } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    act(() => push('reconnecting'))
    const dot = screen.getByTestId('connection-dot')
    expect(dot).toHaveAttribute('data-status', 'reconnecting')
  })

  it('dot has red indicator class on disconnected status', () => {
    const { source, push } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    act(() => push('disconnected'))
    const dot = screen.getByTestId('connection-dot')
    expect(dot).toHaveAttribute('data-status', 'disconnected')
  })

  it('dot has red indicator class on error status', () => {
    const { source, push } = makeControllableConnection()
    const venue = makeVenue(source)
    const wrapper = makeWrapper({}, venue)
    render(<ConnectionStatusBar />, { wrapper })
    act(() => push('error'))
    const dot = screen.getByTestId('connection-dot')
    expect(dot).toHaveAttribute('data-status', 'error')
  })
})
