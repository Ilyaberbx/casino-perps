import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { errAsync, okAsync } from 'neverthrow'
import { DepositContext, type DepositState } from '../deposit-provider.context'
import { useDeposit, useOwnDeposit } from '../use-deposit'
import { buildFakeExchangeGateway } from '../../../gateway/__fixtures__/fake-exchange-gateway'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { WalletAddress } from '@/modules/shared/domain'

// ---------------------------------------------------------------------------
// Mock @/modules/account — same shape as the builder-fee tests
// ---------------------------------------------------------------------------

const mockPrimaryWalletAddress: WalletAddress =
  '0xdeadbeef00000000000000000000000000000001' as WalletAddress

const defaultAuthState = {
  ready: true,
  authenticated: true,
  walletReady: true,
  primaryWalletAddress: mockPrimaryWalletAddress,
  getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
  privyId: null,
  walletAddress: null,
  walletSource: null,
  getAccessToken: async () => null,
  logout: async () => undefined,
  hasMfa: false,
  enrollMfa: () => okAsync(undefined),
  loginWithWallet: () => errAsync(new Error('stub') as never),
  openConnectModal: () => undefined,
  closeConnectModal: () => undefined,
  isConnectModalOpen: false,
  exportableAddresses: [],
  exportWallet: async () => {},
  importPrivateKey: async () => ({ address: '0x0000000000000000000000000000000000000000' }),
  apiClient: {} as never,
}

// The Selected Wallet → master seam (slice 07). Deposit keys on this
// `masterAddress`, not `primaryWalletAddress`. Defaults to the primary.
const defaultSelectedWallet = {
  selectedAddress: null as string | null,
  masterAddress: mockPrimaryWalletAddress as WalletAddress | null,
  nativeAddress: mockPrimaryWalletAddress as WalletAddress | null,
  isSelectionConnectable: true,
}

const { useAuthMock, useSelectedWalletMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useSelectedWalletMock: vi.fn(),
}))
vi.mock('@/modules/account', () => ({
  useAuth: useAuthMock,
  useOnboardingFlow: vi.fn(() => ({ kind: 'ready', me: {} as never })),
  useSelectedWallet: useSelectedWalletMock,
  useIsWalletConnected: () => {
    const a = useAuthMock()
    return a.ready && a.authenticated && a.walletReady
  },
}))

import { useAuth, useSelectedWallet } from '@/modules/account'

useAuthMock.mockReturnValue(defaultAuthState)
useSelectedWalletMock.mockReturnValue(defaultSelectedWallet)

function setAuthState(overrides: Partial<typeof defaultAuthState>) {
  vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState, ...overrides } as never)
}

function setSelectedWallet(overrides: Partial<typeof defaultSelectedWallet>) {
  vi.mocked(useSelectedWallet).mockReturnValue({
    ...defaultSelectedWallet,
    ...overrides,
  } as never)
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

describe('useDeposit() consumer hook', () => {
  it('throws when used outside DepositProvider', () => {
    expect(() => renderHook(() => useDeposit())).toThrow(
      'useDeposit must be used inside <DepositProvider>',
    )
  })
})

// ---------------------------------------------------------------------------
// Smart hook
// ---------------------------------------------------------------------------

describe('useOwnDeposit() smart hook', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState } as never)
    vi.mocked(useSelectedWallet).mockReturnValue({ ...defaultSelectedWallet } as never)
  })

  // Slice 07: the First Deposit milestone keys on the Selected Wallet master.
  const SELECTED_WALLET_ADDRESS =
    '0xabcabcab00000000000000000000000000000002' as WalletAddress

  it('queries the funded milestone for the Selected Wallet master address (not the Primary)', async () => {
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    const querySpy = vi.fn(() => okAsync(true))
    const fakeGateway = buildFakeExchangeGateway({ queryHasEverFunded: querySpy })
    renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(querySpy).toHaveBeenCalledWith(SELECTED_WALLET_ADDRESS)
  })

  it('starts in status "checking"', () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryHasEverFunded: () => okAsync(true),
    })
    const { result } = renderHook(() => useOwnDeposit(fakeGateway))
    expect(result.current.status).toBe('checking')
  })

  it('bootstrap queryHasEverFunded ok(true) → status "funded"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryHasEverFunded: () => okAsync(true),
    })
    const { result } = renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(result.current.status).toBe('funded')
  })

  it('bootstrap queryHasEverFunded ok(false) → status "needs-deposit"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryHasEverFunded: () => okAsync(false),
    })
    const { result } = renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(result.current.status).toBe('needs-deposit')
  })

  it('bootstrap queryHasEverFunded err → status { kind: "error", reason } (genuine query failure)', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryHasEverFunded: () => errAsync(new HyperliquidGatewayError('network', 'query failed')),
    })
    const { result } = renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'unknown' })
  })

  it('recheck() re-runs queryHasEverFunded and transitions needs-deposit → funded', async () => {
    let callCount = 0
    const fakeGateway = buildFakeExchangeGateway({
      queryHasEverFunded: () => {
        callCount++
        return callCount === 1 ? okAsync(false) : okAsync(true)
      },
    })
    const { result } = renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(result.current.status).toBe('needs-deposit')

    await act(async () => {
      result.current.recheck()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.status).toBe('funded')
  })

  it('does not bootstrap when not connected (setAuthState ready:false → querySpy not called)', async () => {
    setAuthState({ ready: false })
    const querySpy = vi.fn(() => okAsync(true))
    const fakeGateway = buildFakeExchangeGateway({ queryHasEverFunded: querySpy })
    renderHook(() => useOwnDeposit(fakeGateway))
    await flush()
    expect(querySpy).not.toHaveBeenCalled()
  })

  // Verify DepositContext injection works for test harness
  it('returns context value when inside DepositContext.Provider', () => {
    const contextValue: DepositState = {
      status: 'funded',
      recheck: () => undefined,
    }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(DepositContext.Provider, { value: contextValue }, children)
    const { result } = renderHook(() => useDeposit(), { wrapper })
    expect(result.current.status).toBe('funded')
  })
})
