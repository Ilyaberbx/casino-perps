import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { okAsync } from 'neverthrow'
import type {
  EquityExtensionBucket,
  MarginSummarySnapshot,
  PortfolioSnapshot,
  Venue,
} from '@/modules/shared/domain'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { ManageFundsProvider } from '@/modules/shared/providers/manage-funds-provider'
import { TradingModeProvider } from '@/modules/shared/providers/trading-mode-provider'
import type { TradingMode } from '@/modules/shared/providers/trading-mode-provider'
import { TRADING_MODE_STORAGE_KEY } from '@/modules/shared/providers/trading-mode-provider/trading-mode.constants'
import { SpectateProvider } from '@/modules/spectate'
import {
  buildFakeDepositCapability,
  buildFakeTransferCapability,
  buildFakeWithdrawCapability,
} from '@/modules/shared/components/manage-funds-modal/__fixtures__/fake-manage-funds-venue'

// Distinct Spot / Perps so the breakdown rows never collide with the $3.03
// headline (Total Equity = accountValue − uPnL(0) = 3.03).
const SNAPSHOT: PortfolioSnapshot = {
  accountValue: 3.03,
  pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
  perpsPnl: 0,
  volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
  spotEquity: 1.03,
  perpsEquity: 2.0,
  fourteenDayVolume: 0,
  timestamp: 1,
}

const MARGIN: MarginSummarySnapshot = {
  maintenanceMarginUsd: 1.25,
  accountLeverage: 2.5,
  marginRatioPct: 10,
  unrealizedPnlUsd: 0,
  totalCrossPositionsValueUsd: 7.5,
  crossAccountValueUsd: 3.03,
}

const BUCKETS: ReadonlyArray<EquityExtensionBucket> = [
  { key: 'vault', label: 'Vault Equity', amountUsd: 1.5 },
  { key: 'earn', label: 'Earn Balance', amountUsd: 0.75 },
  { key: 'staking', label: 'Staking Account', amountUsd: 0.5 },
]

export function buildEquityCardVenue(isSegregated = true): Venue {
  return {
    metadata: { id: 'mock', label: 'Mock' },
    capabilities: {
      connection: { status: () => 'connected', subscribe: () => () => {} },
      portfolio: {
        subscribeSnapshot: (_scope, cb) => {
          cb(SNAPSHOT)
          return () => {}
        },
        getHistory: () => okAsync([]),
      },
      accountMode: {
        current: () => ({ isSegregated }),
        subscribe: () => () => {},
      },
      marginSummary: {
        subscribe: (cb) => {
          cb(MARGIN)
          return () => {}
        },
      },
      equityExtensions: {
        subscribe: (_scope, cb) => {
          cb(BUCKETS)
          return () => {}
        },
      },
    },
    deposit: buildFakeDepositCapability(),
    transfer: buildFakeTransferCapability(),
    withdraw: buildFakeWithdrawCapability(),
  }
}

export const CONNECTED_AUTH: AuthState = {
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

export function wrapEquityCard(venue: Venue, mode: TradingMode) {
  // The provider hydrates from localStorage; set the mode there before render.
  localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode)
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={CONNECTED_AUTH}>
        <TradingModeProvider>
          <VenueProvider venue={venue}>
            <ManageFundsProvider>{children}</ManageFundsProvider>
          </VenueProvider>
        </TradingModeProvider>
      </AuthContext.Provider>
    )
  }
}

// Same composition as `wrapEquityCard`, plus a real `SpectateProvider` (inside
// a `MemoryRouter`, since spectate state is URL-driven) so a test can toggle
// `isSpectating` via `useSpectate().startSpectating()` / `stopSpectating()`.
export function wrapEquityCardWithSpectate(venue: Venue, mode: TradingMode) {
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
