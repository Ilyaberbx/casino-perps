import type { ReactNode } from 'react'
import { okAsync } from 'neverthrow'
import { AuthContext, type AuthState } from '@/modules/account'
import { createApiClient } from '@/modules/shared/http'
import { VenueProvider } from '@/modules/shared/providers/venue-provider'
import { FakeToastProvider } from '@/modules/shared/providers/toast-provider/__fixtures__/fake-toast-provider'
import { makeVenue } from '@/modules/shared/providers/venue-provider/__fixtures__/venue'
import type { ToastPayload } from '@/modules/shared/services/toast'
import type { Trader, Venue } from '@/modules/shared/domain'
import { SuggestionPreviewProvider } from '../../../providers/suggestion-preview-provider'
import type { PreviewTarget } from '../../../providers/suggestion-preview-provider'

/** A fully-populated, wallet-connected `AuthState` for the Place gate. */
export const connectedAuth: AuthState = {
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

export interface PreviewWrapperOptions {
  /** The trader capability mounted on the venue. Omit to mount no trader. */
  readonly trader?: Trader
  /** The preview's initial target (opens the sheet). Omit to leave it closed. */
  readonly defaultTarget?: PreviewTarget | null
  /** Override the auth state — defaults to wallet-connected. */
  readonly auth?: AuthState
  /** Capture every toast shown through the provider. */
  readonly onToast?: (payload: ToastPayload) => void
}

/**
 * The standard provider stack for the suggestion preview: a `VenueProvider`
 * carrying the (optional) trader capability, the `SuggestionPreviewProvider`
 * seeded with `defaultTarget` so the preview opens in tests, a wallet-connected
 * `AuthContext` so the `ConnectWalletGateButton` renders the Place button, and a
 * `FakeToastProvider` to assert toasts.
 */
export function makePreviewWrapper(options: PreviewWrapperOptions = {}) {
  const venue: Venue = makeVenue(options.trader ? { trader: options.trader } : {})
  const auth = options.auth ?? connectedAuth
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <VenueProvider venue={venue}>
        <FakeToastProvider onCapture={options.onToast}>
          <SuggestionPreviewProvider defaultTarget={options.defaultTarget ?? null}>
            {children}
          </SuggestionPreviewProvider>
        </FakeToastProvider>
      </VenueProvider>
    </AuthContext.Provider>
  )
}

/**
 * jsdom does not implement the `<dialog>` modal methods the shared `Sheet`
 * relies on, and `Sheet` reads `#root` to mark it inert. Install a minimal
 * polyfill + the root element before mounting the SuggestionPreviewSheet.
 */
export function installSheetEnvironment(): void {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.show) {
    HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false
    }
  }
  const existing = document.getElementById('root')
  if (existing) return
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
}
