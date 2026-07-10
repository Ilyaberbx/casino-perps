import { errAsync, okAsync } from 'neverthrow'
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import {
  AuthContext,
  type AuthState,
} from '../../../providers/auth-provider/auth-provider.context'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider'
import type { OnboardingState } from '../../../hooks/onboarding-flow.types'
import type { Me } from '../../../domain/types'
import { useWalletsSection } from '../use-wallets-section'
import { createApiClient } from '@/modules/shared/http'
import { parseWalletAddress } from '@/modules/shared/domain'

const NATIVE = '0xaaaa000000000000000000000000000000000001'
const IMPORTED = '0xbbbb000000000000000000000000000000000002'
const AGENT = '0xcccc000000000000000000000000000000000003'
const LINKED = '0xdddd000000000000000000000000000000000004'

const selectHandler = vi.fn()
const toastShow = vi.fn()

vi.mock('@/modules/shared/services/toast', () => ({
  toast: { show: (arg: unknown) => toastShow(arg) },
}))

function baseHandlers() {
  return [
    http.get('/api/agent-treasury/wallet', () => HttpResponse.json({ address: AGENT })),
    http.post('/api/account/wallets/:address/select', ({ params }) =>
      selectHandler(params.address),
    ),
  ]
}

const server = setupServer(...baseHandlers())

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => {
  server.resetHandlers(...baseHandlers())
  selectHandler.mockReset()
  toastShow.mockReset()
})
afterAll(() => server.close())

function makeMe(): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [
      { chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' },
      { chain: 'evm', address: IMPORTED, isSelected: false, source: 'external' },
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
  connectableMasterAddresses: [IMPORTED.toLowerCase()],
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

function meWithExternals(count: number): Me {
  const externals = Array.from({ length: count }, (_, i) => ({
    chain: 'evm',
    address: `0xeeee00000000000000000000000000000000000${i}`,
    isSelected: false,
    source: 'external' as const,
  }))
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [
      { chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' },
      ...externals,
    ],
  }
}

function wrap(flow: OnboardingState, auth: AuthState = authState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
}

const readyFlow: OnboardingState = { kind: 'ready', me: makeMe() }

// A wrapper whose `ready` flow carries a real `applyMe` that updates the cached
// `me` — modelling the production single-source-of-truth so a test can assert
// that a mutation's returned `Me` reconciles the list.
function wrapLive(initialMe: Me, auth: AuthState = authState) {
  return ({ children }: { children: ReactNode }) => {
    const [me, setMe] = useState<Me>(initialMe)
    const flow: OnboardingState = { kind: 'ready', me, applyMe: setMe, refreshMe: () => okAsync(me) }
    return (
      <AuthContext.Provider value={auth}>
        <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
      </AuthContext.Provider>
    )
  }
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

describe('useWalletsSection', () => {
  it('lists the Native + imported user rows with source labels', () => {
    const { result } = renderHook(() => useWalletsSection(), { wrapper: wrap(readyFlow) })
    expect(result.current.rows).toHaveLength(2)
    const native = result.current.rows.find((r) => r.address === NATIVE)
    const imported = result.current.rows.find((r) => r.address === IMPORTED)
    expect(native?.sourceLabel).toBe('Native')
    expect(native?.isNative).toBe(true)
    expect(native?.isSelected).toBe(true)
    expect(imported?.sourceLabel).toBe('Linked')
    expect(imported?.isNative).toBe(false)
  })

  it('does NOT count the Agent row toward the 4-wallet cap (G-6)', () => {
    const { result } = renderHook(() => useWalletsSection(), { wrapper: wrap(readyFlow) })
    expect(result.current.walletCap).toBe(4)
    // 2 user wallets — the Agent row is uncounted.
    expect(result.current.walletCount).toBe(2)
    expect(result.current.rows.some((r) => r.address === AGENT)).toBe(false)
  })

  it('selecting a non-selected row calls /select and optimistically moves the badge', async () => {
    selectHandler.mockImplementation(() => HttpResponse.json(makeMe()))
    const { result } = renderHook(() => useWalletsSection(), { wrapper: wrap(readyFlow) })

    act(() => {
      result.current.onSelect(IMPORTED)
    })

    // Optimistic: the badge moves immediately, before the request settles.
    await waitFor(() => {
      const imported = result.current.rows.find((r) => r.address === IMPORTED)
      expect(imported?.isSelected).toBe(true)
    })
    const native = result.current.rows.find((r) => r.address === NATIVE)
    expect(native?.isSelected).toBe(false)
    expect(selectHandler).toHaveBeenCalledWith(IMPORTED)
  })

  it('onSelect applies the server-returned Me and the badge follows the canonical is_selected', async () => {
    // The server returns Me with IMPORTED now selected.
    selectHandler.mockImplementation(() => HttpResponse.json(meSelecting(IMPORTED)))
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrapLive(meSelecting(NATIVE)),
    })

    act(() => result.current.onSelect(IMPORTED))

    // After the request settles, the optimistic override is cleared and the
    // badge is driven by the canonical (applyMe-updated) `is_selected`.
    await waitFor(() => {
      const imported = result.current.rows.find((r) => r.address === IMPORTED)
      expect(imported?.isSelected).toBe(true)
    })
    const native = result.current.rows.find((r) => r.address === NATIVE)
    expect(native?.isSelected).toBe(false)
    expect(selectHandler).toHaveBeenCalledWith(IMPORTED)
  })

  it('onSelect failure rolls the optimistic badge back to the server selection', async () => {
    selectHandler.mockImplementation(() =>
      HttpResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 }),
    )
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrapLive(meSelecting(NATIVE)),
    })

    act(() => result.current.onSelect(IMPORTED))

    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })),
    )
    const native = result.current.rows.find((r) => r.address === NATIVE)
    expect(native?.isSelected).toBe(true)
    const imported = result.current.rows.find((r) => r.address === IMPORTED)
    expect(imported?.isSelected).toBe(false)
  })
})

describe('useWalletsSection import cap', () => {
  it('reports importedCount + is NOT at cap below 3 externals', () => {
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrap({ kind: 'ready', me: meWithExternals(1) }),
    })
    expect(result.current.importedCount).toBe(1)
    expect(result.current.importCap).toBe(3)
    expect(result.current.isImportAtCap).toBe(false)
  })

  it('is at cap with a 3/3 hint once 3 externals are held (Native excluded)', () => {
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrap({ kind: 'ready', me: meWithExternals(3) }),
    })
    expect(result.current.importedCount).toBe(3)
    expect(result.current.isImportAtCap).toBe(true)
    expect(result.current.importHint).toBe('3/3 imported')
  })
})

describe('useWalletsSection import flow', () => {
  it('links a wallet → imports it → success toast → list updates', async () => {
    const importHandler = vi.fn()
    server.use(
      http.post('/api/account/wallets/import', async ({ request }) => {
        const body = (await request.json()) as { address: string }
        importHandler(body.address)
        return HttpResponse.json(meWithExternals(2))
      }),
    )
    const auth: AuthState = { ...authState, linkWallet: () => okAsync(LINKED) }
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrapLive(meWithExternals(1), auth),
    })

    act(() => result.current.onImport())

    await waitFor(() => expect(importHandler).toHaveBeenCalledWith(LINKED))
    await waitFor(() => expect(result.current.importedCount).toBe(2))
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    )
  })

  it('error toasts when import fails', async () => {
    server.use(
      http.post('/api/account/wallets/import', () =>
        HttpResponse.json({ error: { code: 'WALLET_CAP_REACHED' } }, { status: 409 }),
      ),
    )
    const auth: AuthState = { ...authState, linkWallet: () => okAsync(LINKED) }
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrap({ kind: 'ready', me: meWithExternals(0) }, auth),
    })

    act(() => result.current.onImport())

    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'error' }),
      ),
    )
  })

  it('does not toast (silent) when the user cancels the link modal', async () => {
    const auth: AuthState = {
      ...authState,
      linkWallet: () => errAsync({ kind: 'cancelled' } as const),
    }
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrap({ kind: 'ready', me: meWithExternals(0) }, auth),
    })

    act(() => result.current.onImport())

    await waitFor(() => expect(result.current.isImporting).toBe(false))
    expect(toastShow).not.toHaveBeenCalled()
  })
})

describe('useWalletsSection remove flow', () => {
  it('removes a wallet → success toast → list updates', async () => {
    const removeHandler = vi.fn()
    server.use(
      http.delete('/api/account/wallets/:address', ({ params }) => {
        removeHandler(params.address)
        return HttpResponse.json(meWithExternals(0))
      }),
    )
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrapLive(meWithExternals(1)),
    })

    act(() => result.current.onRemove('0xeeee000000000000000000000000000000000000'))

    await waitFor(() =>
      expect(removeHandler).toHaveBeenCalledWith('0xeeee000000000000000000000000000000000000'),
    )
    await waitFor(() => expect(result.current.importedCount).toBe(0))
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    )
  })
})

describe('useWalletsSection connector icons', () => {
  it('resolves a known connector brand icon for an imported wallet', () => {
    const auth: AuthState = {
      ...authState,
      externalWallets: [{ address: IMPORTED.toLowerCase(), walletClientType: 'metamask' }],
    }
    const { result } = renderHook(() => useWalletsSection(), {
      wrapper: wrap(readyFlow, auth),
    })
    const imported = result.current.rows.find((r) => r.address === IMPORTED)
    expect(imported?.connectorIconUrl).toContain('MetaMask')
    expect(imported?.isRemovable).toBe(true)
    const native = result.current.rows.find((r) => r.address === NATIVE)
    expect(native?.connectorIconUrl).toBeNull()
    expect(native?.isRemovable).toBe(false)
  })
})
