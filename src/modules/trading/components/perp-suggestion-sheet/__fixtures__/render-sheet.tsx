import { type ReactNode } from 'react'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'
import { AuthContext, type AuthError, type AuthState } from '@/modules/account'
import { AgentBalanceSheetProvider } from '@/modules/agent-balance'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { FakeToastProvider } from '@/modules/shared/providers/toast-provider/__fixtures__/fake-toast-provider'
import { makeVenue } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import {
  makeVenueOnboarding,
  makeOnboardingStep,
} from '@/modules/shared/hooks/__fixtures__/venue-onboarding'
import { NetworkError, type ApiClient, type HttpError } from '@/modules/shared/http'
import type {
  Market,
  MarketDataReader,
  PortfolioReader,
  PortfolioSnapshot,
  Unsubscribe,
} from '@/modules/shared/domain'
import type { ToastPayload } from '@/modules/shared/services/toast'
import { PerpSuggestionSheetProvider } from '../../../providers/perp-suggestion-sheet-provider'
import { SuggestionPreviewProvider } from '../../../providers/suggestion-preview-provider'
import { SuggestionInboxProvider } from '../../../providers/suggestion-inbox-provider'
import type { GetSuggestionInbox } from '../../../api/get-suggestion-inbox'
import type { SuggestionOutcome } from '../../../api/suggestions.types'
import { SelectedMarketContext } from '../../../providers/selected-market-provider/selected-market-provider.context'
import type { PreviewTarget } from '../../../providers/suggestion-preview-provider/suggestion-preview-provider.types'

/**
 * Test wrapper mounting every provider `usePerpSuggestionSheetContent` reads,
 * with the cross-module hooks faked at the context seam (no router, no live
 * venue stream). The sheet hook itself is exercised via the real estimate /
 * execute / history / delegation deps injected by the caller.
 */

const FALLBACK_API_CLIENT_ERROR: HttpError = new NetworkError(
  'fixture api client not wired — inject deps instead',
  null,
)

/** An ApiClient that fails loudly — every real call should go through `deps`. */
function makeFakeApiClient(): ApiClient {
  const fail = <T,>(): ResultAsync<T, HttpError> => errAsync(FALLBACK_API_CLIENT_ERROR)
  return {
    get: fail,
    post: fail,
    delete: fail,
    subscribeToSessionExpired: () => () => undefined,
  }
}

interface RenderSheetAuthOptions {
  readonly connected?: boolean
}

const NOT_CONFIGURED: AuthError = { kind: 'not-configured' }

function makeAuthState(options: RenderSheetAuthOptions): AuthState {
  const connected = options.connected ?? true
  const authState: AuthState = {
    ready: true,
    authenticated: connected,
    privyId: connected ? 'did:privy:test' : null,
    walletAddress: connected ? '0xaaaa000000000000000000000000000000000001' : null,
    primaryWalletAddress: null,
    walletSource: null,
    walletReady: connected,
    isBroadcastWalletReady: false,
    connectableMasterAddresses: [],
    externalWallets: [],
    hasMfa: false,
    enrollMfa: () => okAsync(undefined),
    getAccessToken: async () => 'jwt',
    logout: async () => undefined,
    loginWithWallet: () => errAsync(NOT_CONFIGURED),
    linkWallet: () => errAsync(NOT_CONFIGURED),
    openConnectModal: () => undefined,
    closeConnectModal: () => undefined,
    isConnectModalOpen: false,
    exportableAddresses: [],
    exportWallet: async () => {},
    importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
    apiClient: makeFakeApiClient(),
    getMasterViemAccount: async () => null,
    getBroadcastWalletClient: async () => null,
    getAgentWalletBroadcastClient: async () => null,
    switchMasterWalletChain: async () => 'switched',
    createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
    attachAgentSigner: async () => true,
    removeAgentSigner: async () => true,
  }
  return authState
}

function makeMarket(maxLeverage: number | undefined): Market {
  return {
    symbol: 'BTC-PERP',
    baseAsset: 'BTC',
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 1,
    stepSize: 0.001,
    marketType: 'perp',
    hlCoin: 'BTC',
    maxLeverage,
    volume24h: 1_000_000,
  } as Market
}

// Liquid by default (volume above MIN_MARKET_VOLUME_USD) so the SSoT liquidity
// gate (ADR-0064) keeps the default fixture universe in the token list.
function perpMarket(baseAsset: string, maxLeverage: number): Market {
  return {
    symbol: `${baseAsset}-PERP`,
    baseAsset,
    quoteAsset: 'USD',
    venue: 'mock',
    tickSize: 1,
    stepSize: 0.001,
    marketType: 'perp',
    hlCoin: baseAsset,
    maxLeverage,
    volume24h: 1_000_000,
  } as Market
}

/** A marketData reader listing the default token-list universe (slice 05). The
 *  sheet's token list is the intersection of this with the allowlist.
 *  `listMarkets` returns a STABLE reference — `useSyncExternalStore` treats a
 *  fresh array each call as a changed snapshot and loops forever. */
function makeMarketDataReader(markets: readonly Market[]): MarketDataReader {
  const stable = [...markets]
  return {
    refresh: async () => {},
    listMarkets: () => stable,
    subscribeMarkets: () => () => undefined,
    subscribeOrderbook: () => () => undefined,
    subscribeTrades: () => () => undefined,
    subscribeTicker: () => () => undefined,
  } as MarketDataReader
}

/** Default venue perp universe for the sheet fixtures: BTC / ETH / SOL. */
export const DEFAULT_SHEET_MARKETS: readonly Market[] = [
  perpMarket('BTC', 40),
  perpMarket('ETH', 25),
  perpMarket('SOL', 20),
]

/** A portfolio reader whose snapshot drives the margin slider cap. */
export function makePortfolioReader(accountValue: number): PortfolioReader {
  return {
    subscribeSnapshot(_scope, onUpdate): Unsubscribe {
      const snapshot: PortfolioSnapshot = {
        accountValue,
        pnl: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        perpsPnl: 0,
        volume: { '24H': 0, '7D': 0, '30D': 0, AllTime: 0 },
        spotEquity: 0,
        perpsEquity: accountValue,
        fourteenDayVolume: 0,
        timestamp: Date.now(),
      }
      onUpdate(snapshot)
      return () => undefined
    },
    getHistory(): ResultAsync<never[], never> {
      throw new Error('not used in these tests')
    },
  } as PortfolioReader
}

export interface RenderSheetWrapperOptions {
  readonly connected?: boolean
  readonly selectedMarket?: string
  readonly marketMaxLeverage?: number
  readonly accountValue?: number
  readonly onToast?: (payload: ToastPayload) => void
  readonly previewDefault?: PreviewTarget | null
  /** Override the venue perp universe the token list intersects (slice 05). */
  readonly markets?: readonly Market[]
  /**
   * Slice 07 — when set, the venue exposes an `onboarding` slot whose status is
   * `ready` (`true`) or `incomplete` (`false`). Omit ⇒ no onboarding slot (the
   * pre-slice-07 behaviour: the AI execute gate is implicitly ready).
   */
  readonly onboardingReady?: boolean
  /** Spy invoked when the venue onboarding sheet is opened (slice 07 gate). */
  readonly onOpenOnboarding?: () => void
  /** Override the inbox poll feed (ADR-0073). Defaults to an empty inbox so the
   *  provider is inert unless a test drives a resolution. */
  readonly getInbox?: GetSuggestionInbox
  /** Whether the inbox provider polls (ADR-0073). Defaults to `false` — most
   *  sheet tests don't exercise the poll loop. */
  readonly inboxEnabled?: boolean
}

const EMPTY_INBOX: readonly SuggestionOutcome[] = []

function fakeInboxOk(items: readonly SuggestionOutcome[] = EMPTY_INBOX): GetSuggestionInbox {
  return () => okAsync(items)
}

/**
 * Build a `renderHook`/`render` wrapper hosting the required providers. The
 * caller injects `deps` directly into `usePerpSuggestionSheetContent` /
 * `PerpSuggestionSheet`, so the faked api client here is never exercised.
 */
export function makeSheetWrapper(options: RenderSheetWrapperOptions = {}) {
  const connected = options.connected ?? true
  const selectedMarket = options.selectedMarket ?? 'BTC'
  const accountValue = options.accountValue ?? 1000
  const markets = options.markets ?? DEFAULT_SHEET_MARKETS
  const baseVenue = makeVenue({
    portfolio: makePortfolioReader(accountValue),
    marketData: makeMarketDataReader(markets),
  })
  // Slice 07: attach a not-ready / ready onboarding slot so the AI execute gate
  // (`useIsVenueOnboardingReady`) can be exercised. `useVenueOnboarding` returns
  // a stable snapshot — the predicate hook only reads its current status.
  const onboarding =
    options.onboardingReady === undefined
      ? undefined
      : makeVenueOnboarding({
          status: options.onboardingReady ? 'ready' : 'incomplete',
          steps: [makeOnboardingStep({ status: options.onboardingReady ? 'complete' : 'pending' })],
        })
  const venue = onboarding
    ? {
        ...baseVenue,
        onboarding: {
          provider: ({ children }: { children: ReactNode }) => <>{children}</>,
          useVenueOnboarding: () => onboarding,
        },
      }
    : baseVenue
  const authState = makeAuthState({ connected })
  const getInbox = options.getInbox ?? fakeInboxOk()
  const inboxEnabled = options.inboxEnabled ?? false
  const marketValue = {
    selectedMarket,
    setSelectedMarket: () => undefined,
    market: makeMarket(options.marketMaxLeverage),
  }

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={authState}>
        <VenueProvider venue={venue}>
          <SelectedMarketContext value={marketValue}>
            <FakeToastProvider onCapture={options.onToast}>
              <AgentBalanceSheetProvider>
                <VenueOnboardingSheetProvider>
                  <SuggestionInboxProvider enabled={inboxEnabled} getInbox={getInbox}>
                    <SuggestionPreviewProvider defaultTarget={options.previewDefault ?? null}>
                      <PerpSuggestionSheetProvider defaultOpen>
                        {children}
                      </PerpSuggestionSheetProvider>
                    </SuggestionPreviewProvider>
                  </SuggestionInboxProvider>
                </VenueOnboardingSheetProvider>
              </AgentBalanceSheetProvider>
            </FakeToastProvider>
          </SelectedMarketContext>
        </VenueProvider>
      </AuthContext.Provider>
    )
  }
}
