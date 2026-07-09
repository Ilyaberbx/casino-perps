import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { AuthBridgeForTest } from '../__fixtures__/auth-bridge-for-test'
import { useAuth } from '../use-auth'
import { toast } from '@/modules/shared/services/toast'
import type { ToastPayload } from '@/modules/shared/services/toast'

vi.mock('@privy-io/react-auth', () => ({
  useLoginWithEmail: () => ({
    sendCode: vi.fn(),
    loginWithCode: vi.fn(),
    state: { status: 'initial' },
  }),
}))

vi.mock('@/modules/shared/providers/toast-provider', () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

vi.mock('@/app/logger', () => {
  const child = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn(() => child) }
  return { logger: { ...child, child: vi.fn(() => child) } }
})

const logoutMock = vi.fn().mockResolvedValue(undefined)
const getAccessTokenMock = vi.fn().mockResolvedValue('jwt')
const enrollMfaMock = vi.fn().mockResolvedValue(undefined)
const loginWithWalletMock = vi.fn().mockResolvedValue(undefined)
const linkWalletMock = vi
  .fn()
  .mockResolvedValue('0x0000000000000000000000000000000000000000')

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  logoutMock.mockClear()
  getAccessTokenMock.mockClear()
  getAccessTokenMock.mockResolvedValue('jwt')
})
afterAll(() => server.close())

function Caller({ path }: { path: string }) {
  const { apiClient } = useAuth()
  // Trigger the request from a child to ensure it bubbles through the apiClient
  // owned by AuthProvider. ResultAsync resolves (never rejects); the side-effect
  // we test is that AuthProvider calls logout() in response to SessionExpiredError
  // notified via subscribeToSessionExpired.
  void apiClient.get(path)
  return null
}

describe('AuthProvider session-expired handling', () => {
  it('calls logout() when the apiClient emits SessionExpiredError', async () => {
    server.use(
      http.get('/api/x', () => new HttpResponse(null, { status: 401 })),
    )
    render(
      <AuthBridgeForTest
        apiBaseUrl=""
        ready
        authenticated
        privyId="did:privy:abc"
        walletAddress="0xaaaa000000000000000000000000000000000001"
        walletClientType="privy"
        walletsReady
        isBroadcastWalletReady={false}

        connectableMasterAddresses={[]}
        externalWallets={[]}
        exportableAddresses={[]}
        hasMfa={false}
        getAccessToken={getAccessTokenMock}
        logout={logoutMock}
        enrollMfa={enrollMfaMock}
        exportWallet={async () => {}}
        importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
        loginWithWallet={loginWithWalletMock}
        linkWallet={linkWalletMock}
        getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
      >
        <Caller path="/api/x" />
      </AuthBridgeForTest>,
    )

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1))
  })

  it('purges privy: localStorage keys (preserving others) when the session expires', async () => {
    localStorage.setItem('privy:token', 'stale')
    localStorage.setItem('privy:refresh_token', 'stale')
    localStorage.setItem('theme', 'dark')
    server.use(
      http.get('/api/x', () => new HttpResponse(null, { status: 401 })),
    )
    render(
      <AuthBridgeForTest
        apiBaseUrl=""
        ready
        authenticated
        privyId="did:privy:abc"
        walletAddress="0xaaaa000000000000000000000000000000000001"
        walletClientType="privy"
        walletsReady
        isBroadcastWalletReady={false}

        connectableMasterAddresses={[]}
        externalWallets={[]}
        exportableAddresses={[]}
        hasMfa={false}
        getAccessToken={getAccessTokenMock}
        logout={logoutMock}
        enrollMfa={enrollMfaMock}
        exportWallet={async () => {}}
        importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
        loginWithWallet={loginWithWalletMock}
        linkWallet={linkWalletMock}
        getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
      >
        <Caller path="/api/x" />
      </AuthBridgeForTest>,
    )

    await waitFor(() => expect(localStorage.getItem('privy:token')).toBeNull())
    expect(localStorage.getItem('privy:refresh_token')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
    localStorage.clear()
  })

  it('does not call logout() on a non-401 error', async () => {
    server.use(
      http.get('/api/x', () => new HttpResponse('boom', { status: 500 })),
    )
    render(
      <AuthBridgeForTest
        apiBaseUrl=""
        ready
        authenticated
        privyId="did:privy:abc"
        walletAddress="0xaaaa000000000000000000000000000000000001"
        walletClientType="privy"
        walletsReady
        isBroadcastWalletReady={false}

        connectableMasterAddresses={[]}
        externalWallets={[]}
        exportableAddresses={[]}
        hasMfa={false}
        getAccessToken={getAccessTokenMock}
        logout={logoutMock}
        enrollMfa={enrollMfaMock}
        exportWallet={async () => {}}
        importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
        loginWithWallet={loginWithWalletMock}
        linkWallet={linkWalletMock}
        getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
      >
        <Caller path="/api/x" />
      </AuthBridgeForTest>,
    )

    // Wait for the fetch lifecycle to settle, then assert no logout.
    await new Promise((r) => setTimeout(r, 50))
    expect(logoutMock).not.toHaveBeenCalled()
  })
})

function ConnectModalTrigger() {
  const { openConnectModal, isConnectModalOpen } = useAuth()
  return (
    <div>
      <span data-testid="modal-open-flag">{String(isConnectModalOpen)}</span>
      <button type="button" onClick={openConnectModal}>open</button>
    </div>
  )
}

// AuthProvider owns the connect-modal OPEN STATE (isConnectModalOpen), not the
// stepper UI — the OnboardingStepper now mounts under the shared
// OnboardingFlowProvider in AccountSessionRoot (its rendering is covered by the
// OnboardingStepper component tests). These tests assert the state contract.
describe('AuthProvider connect-modal state', () => {
  it('starts closed and opens when openConnectModal is called', async () => {
    const user = userEvent.setup()
    render(
      <AuthBridgeForTest
        apiBaseUrl=""
        ready
        authenticated={false}
        privyId={null}
        walletAddress={null}
        walletClientType={null}
        walletsReady={false}
        isBroadcastWalletReady={false}

        connectableMasterAddresses={[]}
        externalWallets={[]}
        exportableAddresses={[]}
        hasMfa={false}
        getAccessToken={getAccessTokenMock}
        logout={logoutMock}
        enrollMfa={enrollMfaMock}
        exportWallet={async () => {}}
        importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
        loginWithWallet={loginWithWalletMock}
        linkWallet={linkWalletMock}
        getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
      >
        <ConnectModalTrigger />
      </AuthBridgeForTest>,
    )

    expect(screen.getByTestId('modal-open-flag')).toHaveTextContent('false')

    await user.click(screen.getByRole('button', { name: 'open' }))

    expect(screen.getByTestId('modal-open-flag')).toHaveTextContent('true')
  })

  it('closes (isConnectModalOpen=false) when authenticated transitions from false to true', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AuthBridgeForTest
        apiBaseUrl=""
        ready
        authenticated={false}
        privyId={null}
        walletAddress={null}
        walletClientType={null}
        walletsReady={false}
        isBroadcastWalletReady={false}

        connectableMasterAddresses={[]}
        externalWallets={[]}
        exportableAddresses={[]}
        hasMfa={false}
        getAccessToken={getAccessTokenMock}
        logout={logoutMock}
        enrollMfa={enrollMfaMock}
        exportWallet={async () => {}}
        importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
        loginWithWallet={loginWithWalletMock}
        linkWallet={linkWalletMock}
        getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
      >
        <ConnectModalTrigger />
      </AuthBridgeForTest>,
    )

    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByTestId('modal-open-flag')).toHaveTextContent('true')

    await act(async () => {
      rerender(
        <AuthBridgeForTest
          apiBaseUrl=""
          ready
          authenticated
          privyId="did:privy:abc"
          walletAddress="0xaaaa000000000000000000000000000000000001"
          walletClientType="privy"
          walletsReady
          isBroadcastWalletReady={false}

          connectableMasterAddresses={[]}
          externalWallets={[]}
          exportableAddresses={[]}
          hasMfa={false}
          getAccessToken={getAccessTokenMock}
          logout={logoutMock}
          enrollMfa={enrollMfaMock}
          exportWallet={async () => {}}
          importPrivateKey={async () => ({ address: '0x0000000000000000000000000000000000000000' })}
          loginWithWallet={loginWithWalletMock}
          linkWallet={linkWalletMock}
          getMasterViemAccount={async () => null}
        getBroadcastWalletClient={async () => null}
        getAgentWalletBroadcastClient={async () => null}
        switchMasterWalletChain={async () => 'switched'}
        createAgentWallet={async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' })}
        attachAgentSigner={async () => true}
        removeAgentSigner={async () => true}
        >
          <ConnectModalTrigger />
        </AuthBridgeForTest>,
      )
    })

    await waitFor(() =>
      expect(screen.getByTestId('modal-open-flag')).toHaveTextContent('false'),
    )
  })
})

function LogoutTrigger() {
  const { logout } = useAuth()
  return (
    <button type="button" onClick={() => void logout()}>
      logout
    </button>
  )
}

const authedProps = {
  apiBaseUrl: '',
  ready: true as const,
  authenticated: true as const,
  privyId: 'did:privy:abc',
  walletAddress: '0xaaaa000000000000000000000000000000000001',
  walletClientType: 'privy' as const,
  walletsReady: true as const,
  isBroadcastWalletReady: false,
  connectableMasterAddresses: [],
  externalWallets: [],
  exportableAddresses: [],
  hasMfa: false,
  getAccessToken: getAccessTokenMock,
  logout: logoutMock,
  enrollMfa: enrollMfaMock,
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  loginWithWallet: loginWithWalletMock,
  linkWallet: linkWalletMock,
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  getAgentWalletBroadcastClient: async () => null,
  switchMasterWalletChain: async () => 'switched' as const,
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
}

const loggedOutProps = {
  ...authedProps,
  authenticated: false as const,
  privyId: null,
  walletAddress: null,
  walletClientType: null,
  walletsReady: false as const,
}

// The apiClient subscription only fires on a real 401. Privy can also drop a
// session on its own (stale/unrecoverable refresh token, e.g. the Privy user
// was deleted) by flipping `authenticated` to false with no 401 — these tests
// cover that observer path.
describe('AuthProvider involuntary session-loss toast', () => {
  let showSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    showSpy = vi.spyOn(toast, 'show').mockImplementation(() => 'toast-id')
  })
  afterEach(() => showSpy.mockRestore())

  const sessionExpiredCalls = () =>
    showSpy.mock.calls.filter(
      ([payload]: [ToastPayload]) => payload?.id === 'session-expired',
    )

  it('shows the session-expired toast when authenticated flips true→false on its own', async () => {
    const { rerender } = render(
      <AuthBridgeForTest {...authedProps}>
        <LogoutTrigger />
      </AuthBridgeForTest>,
    )
    expect(sessionExpiredCalls()).toHaveLength(0)

    await act(async () => {
      rerender(
        <AuthBridgeForTest {...loggedOutProps}>
          <LogoutTrigger />
        </AuthBridgeForTest>,
      )
    })

    await waitFor(() => expect(sessionExpiredCalls()).toHaveLength(1))
  })

  it('stays quiet when the user logs out deliberately', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AuthBridgeForTest {...authedProps}>
        <LogoutTrigger />
      </AuthBridgeForTest>,
    )

    await user.click(screen.getByRole('button', { name: 'logout' }))
    expect(logoutMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerender(
        <AuthBridgeForTest {...loggedOutProps}>
          <LogoutTrigger />
        </AuthBridgeForTest>,
      )
    })

    // Give the observer effect a chance to run, then assert it stayed silent.
    await new Promise((r) => setTimeout(r, 50))
    expect(sessionExpiredCalls()).toHaveLength(0)
  })
})
