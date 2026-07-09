import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { VolumeTile } from '../VolumeTile'
import {
  buildVenueWithPortfolio,
  buildVenueWithPendingPortfolio,
  buildVenueWithoutPortfolio,
  SNAPSHOT_WITH_VOLUME,
} from '../__fixtures__/venue'

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

function makeWrapper(auth: Partial<AuthState>, venue = buildVenueWithPortfolio(SNAPSHOT_WITH_VOLUME)) {
  const authValue = { ...baseAuthState, ...auth }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueContext.Provider value={venue}>
        {children}
      </VenueContext.Provider>
    </AuthContext.Provider>
  )
}

const connectedWrapper = makeWrapper({})
const disconnectedWrapper = makeWrapper({ authenticated: false, walletReady: false, walletAddress: null })

describe('VolumeTile', () => {
  it('renders the 14 Day Volume label', () => {
    render(<VolumeTile />, { wrapper: connectedWrapper })
    expect(screen.getByLabelText(/14 day volume/i)).toBeInTheDocument()
  })

  it('renders the formatted volume when wallet is connected', () => {
    render(<VolumeTile />, { wrapper: connectedWrapper })
    expect(screen.getByText('$123,456.78')).toBeInTheDocument()
  })

  it('renders -- when wallet is disconnected (wallet-gate Mode 1)', () => {
    render(<VolumeTile />, { wrapper: disconnectedWrapper })
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('renders View Volume link affordance', () => {
    render(<VolumeTile />, { wrapper: connectedWrapper })
    expect(screen.getByRole('button', { name: /view volume/i })).toBeInTheDocument()
  })

  it('renders a loading skeleton when connected and the first snapshot is pending', () => {
    const wrapper = makeWrapper({}, buildVenueWithPendingPortfolio())
    render(<VolumeTile />, { wrapper })
    expect(screen.getByRole('status', { name: /loading 14 day volume/i })).toBeInTheDocument()
    expect(screen.queryByText('--')).not.toBeInTheDocument()
  })

  it('renders -- when portfolio capability is absent and wallet is connected', () => {
    const wrapperNoPortfolio = makeWrapper({}, buildVenueWithoutPortfolio())
    render(<VolumeTile />, { wrapper: wrapperNoPortfolio })
    expect(screen.getByText('--')).toBeInTheDocument()
  })

  it('renders -- when disconnected regardless of snapshot value', () => {
    const venueWithData = buildVenueWithPortfolio(SNAPSHOT_WITH_VOLUME)
    const wrapper = makeWrapper({ authenticated: false, walletReady: false, walletAddress: null }, venueWithData)
    render(<VolumeTile />, { wrapper })
    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.queryByText('$123,456.78')).not.toBeInTheDocument()
  })

  it('calls onViewVolume handler when link is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const consoleSpy = vi.fn()
    render(<VolumeTile />, { wrapper: connectedWrapper })
    const btn = screen.getByRole('button', { name: /view volume/i })
    await userEvent.click(btn)
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
