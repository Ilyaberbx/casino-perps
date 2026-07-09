import { okAsync } from 'neverthrow'
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  AuthContext,
  type AuthState,
} from '../../../providers/auth-provider/auth-provider.context'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider'
import { AgentBalanceSheetProvider } from '@/modules/agent-balance'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { VenueOnboardingSheetProvider } from '@/modules/shared/providers/venue-onboarding-sheet-provider'
import { makeVenue } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import type { OnboardingState } from '../../../hooks/onboarding-flow.types'
import type { Me } from '../../../domain/types'
import { WalletsSection } from '../WalletsSection'
import { createApiClient } from '@/modules/shared/http'
import { parseWalletAddress } from '@/modules/shared/domain'

const NATIVE = '0xaaaa000000000000000000000000000000000001'
const IMPORTED = '0xbbbb000000000000000000000000000000000002'
const AGENT = '0xcccc000000000000000000000000000000000003'

const server = setupServer(
  http.get('/api/agent-treasury/wallet', () => HttpResponse.json({ address: AGENT })),
  // Echo the chosen address back as the new `is_selected` so the canonical
  // cache (via `applyMe`) reconciles onto it after the optimistic move.
  http.post('/api/account/wallets/:address/select', ({ params }) =>
    HttpResponse.json(meSelecting(String(params.address))),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeMe(): Me {
  return meSelecting(NATIVE)
}

function meSelecting(selected: string): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [
      { chain: 'evm', address: NATIVE, isSelected: selected === NATIVE, source: 'embedded' },
      { chain: 'evm', address: IMPORTED, isSelected: selected === IMPORTED, source: 'external' },
    ],
  }
}

const authState: AuthState = {
  ready: true,
  authenticated: true,
  privyId: 'did:privy:abc',
  walletAddress: NATIVE,
  primaryWalletAddress: parseWalletAddress(NATIVE)._unsafeUnwrap(),
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
  apiClient: createApiClient({ getAccessToken: async () => 'jwt', baseUrl: '' }),
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  getAgentWalletBroadcastClient: async () => null,
  switchMasterWalletChain: async () => 'switched',
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
}

function wrap(flow: OnboardingState) {
  // Slice 07: the per-DEX balance panel reads the active venue + the onboarding
  // sheet controller — mount both (a mock venue with no onboarding ⇒ ready).
  const venue = makeVenue()
  return ({ children }: { children: ReactNode }) => {
    // Model the canonical single source of truth: a `ready` flow carries a real
    // `applyMe` that updates the cached `me`, so a mutation's returned `Me`
    // reconciles the rendered list (Workstream D). Non-`ready` flows pass through.
    const [me, setMe] = useState<Me | null>(flow.kind === 'ready' ? flow.me : null)
    const liveFlow: OnboardingState =
      flow.kind === 'ready' && me !== null
        ? { kind: 'ready', me, applyMe: setMe, refreshMe: () => okAsync(me) }
        : flow
    return (
      <AuthContext.Provider value={authState}>
        <OnboardingFlowContext.Provider value={liveFlow}>
          <VenueProvider venue={venue}>
            <VenueOnboardingSheetProvider>
              <AgentBalanceSheetProvider>{children}</AgentBalanceSheetProvider>
            </VenueOnboardingSheetProvider>
          </VenueProvider>
        </OnboardingFlowContext.Provider>
      </AuthContext.Provider>
    )
  }
}

const readyFlow: OnboardingState = { kind: 'ready', me: makeMe() }

describe('<WalletsSection />', () => {
  it('renders the Native + imported rows and a separated read-only Agent row', () => {
    render(<WalletsSection />, { wrapper: wrap(readyFlow) })
    expect(screen.getByTestId('wallet-row-native')).toBeInTheDocument()
    expect(screen.getByTestId(`wallet-row-${IMPORTED}`)).toBeInTheDocument()
    expect(screen.getByTestId('wallet-row-agent')).toBeInTheDocument()
    // The selected (Native) row carries the Selected badge.
    const native = screen.getByTestId('wallet-row-native')
    expect(within(native).getByText('Selected')).toBeInTheDocument()
  })

  it('clicking a non-selected row triggers select (the whole row is the affordance)', async () => {
    const user = userEvent.setup()
    render(<WalletsSection />, { wrapper: wrap(readyFlow) })
    const imported = screen.getByTestId(`wallet-row-${IMPORTED}`)
    // The whole non-selected row is the select affordance.
    await user.click(within(imported).getByRole('button', { name: /linked/i }))
    // Optimistic badge move onto the imported row.
    expect(within(imported).getByText('Selected')).toBeInTheDocument()
  })

  it('exposes a Copy address action behind the row overflow menu', async () => {
    const user = userEvent.setup()
    render(<WalletsSection />, { wrapper: wrap(readyFlow) })
    const native = screen.getByTestId('wallet-row-native')
    await user.click(within(native).getByLabelText('Wallet actions'))
    // The dropdown is portaled to document.body by the shared Popover (ADR-0037),
    // so it's outside the row's own DOM subtree — query the whole document.
    expect(screen.getByText('Copy address')).toBeInTheDocument()
  })

  it('renders nothing before the onboarding flow is ready', () => {
    render(<WalletsSection />, { wrapper: wrap({ kind: 'resolving' }) })
    expect(screen.queryByTestId('wallet-row-native')).not.toBeInTheDocument()
  })

  it('renders enabled Import Wallet and Import private key buttons below the cap (no hint)', () => {
    render(<WalletsSection />, { wrapper: wrap(readyFlow) })
    expect(screen.getByTestId('wallet-import')).toBeEnabled()
    expect(screen.getByTestId('import-key-open')).toBeEnabled()
    expect(screen.queryByTestId('wallet-import-hint')).not.toBeInTheDocument()
  })

  it('disables both import paths with a 3/3 hint at the imported-wallet cap', () => {
    const externals = [0, 1, 2].map((i) => ({
      chain: 'evm',
      address: `0xeeee00000000000000000000000000000000000${i}`,
      isSelected: false,
      source: 'external' as const,
    }))
    const capped: Me = {
      user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
      wallets: [
        { chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' },
        ...externals,
      ],
    }
    render(<WalletsSection />, { wrapper: wrap({ kind: 'ready', me: capped }) })
    expect(screen.getByTestId('wallet-import')).toBeDisabled()
    expect(screen.getByTestId('import-key-open')).toBeDisabled()
    expect(screen.getByTestId('wallet-import-hint')).toHaveTextContent('3/3 imported')
  })

  it('shows a Remove item for imported rows and none for the Native row', async () => {
    const user = userEvent.setup()
    render(<WalletsSection />, { wrapper: wrap(readyFlow) })

    const imported = screen.getByTestId(`wallet-row-${IMPORTED}`)
    await user.click(within(imported).getByLabelText('Wallet actions'))
    // The dropdown is portaled to document.body by the shared Popover (ADR-0037),
    // so it's outside the row's own DOM subtree — query the whole document.
    expect(screen.getByText('Remove')).toBeInTheDocument()

    const native = screen.getByTestId('wallet-row-native')
    await user.click(within(native).getByLabelText('Wallet actions'))
    expect(screen.queryByText('Remove')).not.toBeInTheDocument()
  })
})
