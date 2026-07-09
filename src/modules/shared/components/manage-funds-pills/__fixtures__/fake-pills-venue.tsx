import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { okAsync } from 'neverthrow'
import type { Venue } from '@/modules/shared/domain'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { SpectateProvider } from '@/modules/spectate'
import { TradingModeProvider } from '../../../providers/trading-mode-provider'
import type { TradingMode } from '../../../providers/trading-mode-provider'
import { TRADING_MODE_STORAGE_KEY } from '../../../providers/trading-mode-provider/trading-mode.constants'
import { VenueProvider } from '../../../providers/venue-provider'
import { ManageFundsProvider } from '../../../providers/manage-funds-provider'
import {
  buildFakeDepositCapability,
  buildFakeTransferCapability,
  buildFakeWithdrawCapability,
} from '../../manage-funds-modal/__fixtures__/fake-manage-funds-venue'

interface BuildVenueOptions {
  readonly deposit?: boolean
  readonly transfer?: boolean
  readonly withdraw?: boolean
}

export function buildPillsVenue(options: BuildVenueOptions = {}): Venue {
  return {
    metadata: { id: 'fake-pills', label: 'Fake Pills Venue' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
    },
    deposit: options.deposit ? buildFakeDepositCapability() : undefined,
    transfer: options.transfer ? buildFakeTransferCapability() : undefined,
    withdraw: options.withdraw ? buildFakeWithdrawCapability() : undefined,
  }
}

/** A connected Auth state so `<ConnectWalletGateButton>` renders its children. */
const CONNECTED_AUTH: AuthState = {
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

interface WrapPillsOptions {
  readonly mode?: TradingMode
  readonly connected?: boolean
}

export function wrapWithPillsVenue(venue: Venue, options: WrapPillsOptions = {}) {
  const mode = options.mode ?? 'pro'
  const connected = options.connected ?? false
  // The provider hydrates from localStorage; set the mode there before render.
  localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode)

  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = (
      <TradingModeProvider>
        <VenueProvider venue={venue}>
          <ManageFundsProvider>{children}</ManageFundsProvider>
        </VenueProvider>
      </TradingModeProvider>
    )
    if (!connected) return tree
    return <AuthContext.Provider value={CONNECTED_AUTH}>{tree}</AuthContext.Provider>
  }
}

// Same composition as `wrapWithPillsVenue`, plus a real `SpectateProvider`
// (inside a `MemoryRouter`, since spectate state is URL-driven) so a test can
// toggle `isSpectating` via `useSpectate().startSpectating()` / `stopSpectating()`.
// Always connected — spectating requires a connected wallet.
export function wrapWithPillsVenueAndSpectate(venue: Venue, options: WrapPillsOptions = {}) {
  const mode = options.mode ?? 'pro'
  localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode)

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <AuthContext.Provider value={CONNECTED_AUTH}>
          <TradingModeProvider>
            <VenueProvider venue={venue}>
              <ManageFundsProvider>
                <SpectateProvider>{children}</SpectateProvider>
              </ManageFundsProvider>
            </VenueProvider>
          </TradingModeProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    )
  }
}
