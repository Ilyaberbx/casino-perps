import { okAsync } from 'neverthrow'
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
import { useQuickWalletSwitcher } from '../use-quick-wallet-switcher'
import { formatWalletAddress } from '@/modules/shared/utils/format-wallet-address'
import { createApiClient } from '@/modules/shared/http'
import { parseWalletAddress } from '@/modules/shared/domain'

const NATIVE = '0xaaaa000000000000000000000000000000000001'
const IMPORTED = '0xbbbb000000000000000000000000000000000002'

const selectHandler = vi.fn()
const toastShow = vi.fn()

vi.mock('@/modules/shared/services/toast', () => ({
  toast: { show: (arg: unknown) => toastShow(arg) },
}))

function baseHandlers() {
  return [
    http.post('/api/account/wallets/:address/select', ({ params }) => selectHandler(params.address)),
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
  linkWallet: () => okAsync('0x0000000000000000000000000000000000000000'),
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

function meSelecting(selected: string): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [
      { chain: 'evm', address: NATIVE, isSelected: selected === NATIVE, source: 'embedded' },
      { chain: 'evm', address: IMPORTED, isSelected: selected === IMPORTED, source: 'external' },
    ],
  }
}

function wrap(flow: OnboardingState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authState}>
      <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
}

// A wrapper whose `ready` flow carries a real `applyMe` (single source of truth)
// so a select round-trip reconciles the cached `me`.
function wrapLive(initialMe: Me) {
  return ({ children }: { children: ReactNode }) => {
    const [me, setMe] = useState<Me>(initialMe)
    const flow: OnboardingState = { kind: 'ready', me, applyMe: setMe, refreshMe: () => okAsync(me) }
    return (
      <AuthContext.Provider value={authState}>
        <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
      </AuthContext.Provider>
    )
  }
}

describe('useQuickWalletSwitcher', () => {
  it('is not ready (renders nothing) until the onboarding flow resolves Me', () => {
    const { result } = renderHook(() => useQuickWalletSwitcher(), {
      wrapper: wrap({ kind: 'resolving' }),
    })
    expect(result.current.isReady).toBe(false)
    expect(result.current.triggerItem).toBeNull()
    expect(result.current.items).toHaveLength(0)
  })

  it('maps wallets to items: Native label + truncated imported address', () => {
    const { result } = renderHook(() => useQuickWalletSwitcher(), {
      wrapper: wrap({ kind: 'ready', me: meSelecting(NATIVE) }),
    })
    expect(result.current.isReady).toBe(true)
    const native = result.current.items.find((i) => i.address === NATIVE)
    const imported = result.current.items.find((i) => i.address === IMPORTED)
    expect(native?.label).toBe('Native')
    expect(imported?.label).toBe(formatWalletAddress(IMPORTED))
  })

  it('surfaces the Selected Wallet as the trigger item + value', () => {
    const { result } = renderHook(() => useQuickWalletSwitcher(), {
      wrapper: wrap({ kind: 'ready', me: meSelecting(IMPORTED) }),
    })
    expect(result.current.value).toBe(IMPORTED)
    expect(result.current.triggerItem?.address).toBe(IMPORTED)
  })

  it('toggles the menu open/closed', () => {
    const { result } = renderHook(() => useQuickWalletSwitcher(), {
      wrapper: wrap({ kind: 'ready', me: meSelecting(NATIVE) }),
    })
    expect(result.current.isOpen).toBe(false)
    act(() => result.current.onToggle())
    expect(result.current.isOpen).toBe(true)
  })

  it('selecting a wallet optimistically moves the value and closes the menu', async () => {
    selectHandler.mockImplementation(() => HttpResponse.json(meSelecting(IMPORTED)))
    const { result } = renderHook(() => useQuickWalletSwitcher(), {
      wrapper: wrapLive(meSelecting(NATIVE)),
    })

    act(() => result.current.onToggle())
    act(() => result.current.onSelectWallet(IMPORTED))

    expect(result.current.isOpen).toBe(false)
    await waitFor(() => expect(result.current.value).toBe(IMPORTED))
    expect(selectHandler).toHaveBeenCalledWith(IMPORTED)
  })
})
