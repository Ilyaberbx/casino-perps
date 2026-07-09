import { okAsync } from 'neverthrow'
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  AuthContext,
  type AuthState,
} from '../../providers/auth-provider/auth-provider.context'
import { useOnboardingFlow } from '../use-onboarding-flow'
import type { Me } from '../../domain/types'
import { createApiClient } from '@/modules/shared/http'

const onboardHandler = vi.fn()
const meHandler = vi.fn()

const server = setupServer(
  http.get('/api/account/me', () => meHandler()),
  http.post('/api/account/onboard', async ({ request }) => onboardHandler(request)),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers(
    http.get('/api/account/me', () => meHandler()),
    http.post('/api/account/onboard', async ({ request }) => onboardHandler(request)),
  )
  meHandler.mockReset()
  onboardHandler.mockReset()
})
afterAll(() => server.close())

const enrollMfa = vi.fn(() => okAsync<void, never>(undefined))

const authState: AuthState = {
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
  hasMfa: true,
  getAccessToken: async () => 'jwt',
  logout: async () => {},
  enrollMfa,
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

function wrap(value: AuthState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

function realHandleMe(handle: string) {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.com', handle, iconUrl: null },
    wallets: [
      {
        chain: 'evm',
        address: '0xaaaa000000000000000000000000000000000001',
        isSelected: true,
        source: 'embedded',
      },
    ],
  }
}

describe('useOnboardingFlow — mandatory handle', () => {
  it('returning user with a real handle → ready, no handle/mfa steps', async () => {
    meHandler.mockReturnValueOnce(HttpResponse.json(realHandleMe('satoshi')))

    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap(authState),
    })
    await waitFor(() => expect(result.current.kind).toBe('ready'))
    expect(onboardHandler).not.toHaveBeenCalled()
  })

  it('new user: getMe 404 → needs-handle WITHOUT creating the account yet', async () => {
    meHandler.mockReturnValueOnce(new HttpResponse(null, { status: 404 }))

    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap(authState),
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-handle'))
    // The account row is NOT created until the handle is submitted.
    expect(onboardHandler).not.toHaveBeenCalled()
  })

  it('submitHandle posts onboard WITH the chosen handle → needs-mfa → skip → personalize → ready', async () => {
    meHandler.mockReturnValueOnce(new HttpResponse(null, { status: 404 }))
    onboardHandler.mockImplementationOnce(async (request: Request) => {
      const body = (await request.json()) as { handle: string; source: string }
      expect(body.handle).toBe('satoshi')
      expect(body.source).toBe('embedded')
      return HttpResponse.json(realHandleMe('satoshi'))
    })

    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap(authState),
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-handle'))

    await act(async () => {
      if (result.current.kind === 'needs-handle') {
        await result.current.submitHandle('satoshi')
      }
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-mfa'))
    expect(onboardHandler).toHaveBeenCalledTimes(1)

    act(() => {
      if (result.current.kind === 'needs-mfa') result.current.skipMfa()
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-personalize'))

    act(() => {
      if (result.current.kind === 'needs-personalize') result.current.finishPersonalize()
    })
    await waitFor(() => expect(result.current.kind).toBe('ready'))
  })

  it('submitHandle forwards the invite code into the onboard body', async () => {
    meHandler.mockReturnValueOnce(new HttpResponse(null, { status: 404 }))
    onboardHandler.mockImplementationOnce(async (request: Request) => {
      const body = (await request.json()) as { handle: string; inviteCode?: string }
      expect(body.handle).toBe('satoshi')
      expect(body.inviteCode).toBe('ABCD2345')
      return HttpResponse.json(realHandleMe('satoshi'))
    })

    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap(authState),
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-handle'))
    await act(async () => {
      if (result.current.kind === 'needs-handle') {
        await result.current.submitHandle('satoshi', 'ABCD2345')
      }
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-mfa'))
    expect(onboardHandler).toHaveBeenCalledTimes(1)
  })

  it('needs-mfa → setupMfa success → personalize → ready', async () => {
    meHandler.mockReturnValueOnce(new HttpResponse(null, { status: 404 }))
    onboardHandler.mockImplementationOnce(async () =>
      HttpResponse.json(realHandleMe('satoshi')),
    )

    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap(authState),
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-handle'))
    await act(async () => {
      if (result.current.kind === 'needs-handle') await result.current.submitHandle('satoshi')
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-mfa'))

    await act(async () => {
      if (result.current.kind === 'needs-mfa') await result.current.setupMfa()
    })
    await waitFor(() => expect(result.current.kind).toBe('needs-personalize'))
    expect(enrollMfa).toHaveBeenCalledTimes(1)

    act(() => {
      if (result.current.kind === 'needs-personalize') result.current.finishPersonalize()
    })
    await waitFor(() => expect(result.current.kind).toBe('ready'))
  })

  it('refreshMe re-GETs /me and replaces the cached me (out-of-band reconcile)', async () => {
    const SELECTED_A = '0xaaaa000000000000000000000000000000000001'
    const SELECTED_B = '0xbbbb000000000000000000000000000000000002'
    function meSelecting(selected: string) {
      return {
        user: { privyId: 'did:privy:abc', email: 'a@b.com', handle: 'satoshi', iconUrl: null },
        wallets: [
          { chain: 'evm', address: SELECTED_A, isSelected: selected === SELECTED_A, source: 'embedded' },
          { chain: 'evm', address: SELECTED_B, isSelected: selected === SELECTED_B, source: 'external' },
        ],
      }
    }
    // First GET (initial resolve) → A selected; second GET (refreshMe) → B selected.
    meHandler
      .mockReturnValueOnce(HttpResponse.json(meSelecting(SELECTED_A)))
      .mockReturnValueOnce(HttpResponse.json(meSelecting(SELECTED_B)))

    const { result } = renderHook(() => useOnboardingFlow(), { wrapper: wrap(authState) })
    await waitFor(() => expect(result.current.kind).toBe('ready'))
    if (result.current.kind !== 'ready') throw new Error('unreachable')
    expect(result.current.me.wallets.find((w) => w.isSelected)?.address).toBe(SELECTED_A)

    await act(async () => {
      if (result.current.kind === 'ready') await result.current.refreshMe?.()
    })

    await waitFor(() => {
      if (result.current.kind !== 'ready') throw new Error('not ready')
      expect(result.current.me.wallets.find((w) => w.isSelected)?.address).toBe(SELECTED_B)
    })
    expect(meHandler).toHaveBeenCalledTimes(2)
  })

  it('applyMe replaces the cached me without a network round-trip', async () => {
    const SELECTED_A = '0xaaaa000000000000000000000000000000000001'
    meHandler.mockReturnValueOnce(HttpResponse.json(realHandleMe('satoshi')))
    const { result } = renderHook(() => useOnboardingFlow(), { wrapper: wrap(authState) })
    await waitFor(() => expect(result.current.kind).toBe('ready'))

    const nextMe: Me = {
      user: { privyId: 'did:privy:abc', email: 'a@b.com', handle: 'satoshi', iconUrl: null },
      wallets: [{ chain: 'evm', address: SELECTED_A, isSelected: true, source: 'embedded' }],
    }
    act(() => {
      if (result.current.kind === 'ready') result.current.applyMe?.(nextMe)
    })

    if (result.current.kind !== 'ready') throw new Error('not ready')
    expect(result.current.me.wallets).toHaveLength(1)
    // Only the initial resolve hit the network — applyMe is local.
    expect(meHandler).toHaveBeenCalledTimes(1)
  })

  it('does nothing while wallet is not ready', () => {
    const { result } = renderHook(() => useOnboardingFlow(), {
      wrapper: wrap({
        ...authState,
        walletReady: false,
        isBroadcastWalletReady: false,
        connectableMasterAddresses: [],
        hasMfa: false,
        walletAddress: null,
        primaryWalletAddress: null,
      }),
    })
    expect(result.current.kind).toBe('idle')
    expect(meHandler).not.toHaveBeenCalled()
  })
})
