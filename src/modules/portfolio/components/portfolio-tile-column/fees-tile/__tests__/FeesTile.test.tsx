import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { VenueContext } from '@/modules/shared/providers/venue-provider/venue-provider.context'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'

// Pro mode is gone (PRD-0008 D7): the fees tile always renders its condensed
// (`simple`) form. The `_mode` param is kept ignored so existing call sites
// still compile.
type LegacyTradingMode = 'pro' | 'simple'
import { FeesTile } from '../FeesTile'
import {
  buildVenueWithFeeSchedule,
  buildVenueWithPendingFeeSchedule,
  buildVenueWithoutFeeSchedule,
  PERPS_SPOT_FEE_SCHEDULE,
} from '../__fixtures__/venue'
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

function makeWrapper(venue: Venue, _mode?: LegacyTradingMode, auth: Partial<AuthState> = {}) {
  const authValue = { ...baseAuthState, ...auth }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authValue}>
      <VenueContext.Provider value={venue}>{children}</VenueContext.Provider>
    </AuthContext.Provider>
  )
}

describe('FeesTile', () => {
  beforeEach(() => localStorage.clear())

  it('renders Fees (Taker / Maker) label', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithFeeSchedule(PERPS_SPOT_FEE_SCHEDULE)) })
    expect(screen.getByLabelText(/fees \(taker \/ maker\)/i)).toBeInTheDocument()
  })

  it('renders Perps row with trimmed taker and maker percentage in happy path', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithFeeSchedule(PERPS_SPOT_FEE_SCHEDULE)) })
    expect(screen.getByText(/perps/i)).toBeInTheDocument()
    expect(screen.getByText(/0\.025% \/ 0\.005%/i)).toBeInTheDocument()
  })

  // Pro mode is gone (PRD-0008 D7): the tile always renders its condensed form
  // (a Perps/Spot selector + a single line), so the standalone Pro Spot row is
  // covered by the selector-switch test below instead.

  it('renders View Fee Schedule link affordance', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithFeeSchedule(PERPS_SPOT_FEE_SCHEDULE)) })
    expect(screen.getByRole('button', { name: /view fee schedule/i })).toBeInTheDocument()
  })

  it('renders a loading skeleton while the fee schedule is pending', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithPendingFeeSchedule()) })
    expect(screen.getByRole('status', { name: /loading fees/i })).toBeInTheDocument()
    expect(screen.queryByText('--')).not.toBeInTheDocument()
  })

  it('renders explicit unsupported state when capability is absent', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithoutFeeSchedule()) })
    expect(screen.getByText(/not supported on this venue/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view fee schedule/i })).not.toBeInTheDocument()
  })

  it('does not render fee rows when capability is absent', () => {
    render(<FeesTile />, { wrapper: makeWrapper(buildVenueWithoutFeeSchedule()) })
    expect(screen.queryByText(/% taker/i)).not.toBeInTheDocument()
  })

  describe('Simple mode (#274)', () => {
    it('shows a Perps/Spot selector and a single taker/maker line', () => {
      render(<FeesTile />, {
        wrapper: makeWrapper(buildVenueWithFeeSchedule(PERPS_SPOT_FEE_SCHEDULE), 'simple'),
      })
      expect(screen.getByRole('button', { name: /fees market/i })).toBeInTheDocument()
      expect(screen.getByText(/0\.025% \/ 0\.005%/i)).toBeInTheDocument()
      // Only one line — the Pro Spot row is not rendered.
      expect(screen.queryByText(/0\.03% \/ 0\.01%/i)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view fee schedule/i })).toBeInTheDocument()
    })

    it('updates the line when the selector switches market', async () => {
      const user = userEvent.setup()
      render(<FeesTile />, {
        wrapper: makeWrapper(buildVenueWithFeeSchedule(PERPS_SPOT_FEE_SCHEDULE), 'simple'),
      })
      await user.click(screen.getByRole('button', { name: /fees market/i }))
      await user.click(screen.getByRole('option', { name: /spot/i }))
      expect(screen.getByText(/0\.03% \/ 0\.01%/i)).toBeInTheDocument()
      expect(screen.queryByText(/0\.025% \/ 0\.005%/i)).not.toBeInTheDocument()
    })
  })
})
