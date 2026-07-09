import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { errAsync, okAsync } from 'neverthrow'
import { Hip3AbstractionContext } from '../hip3-abstraction-provider.context'
import { useHyperliquidHip3Abstraction, useOwnHip3Abstraction } from '../use-hip3-abstraction'
import { buildFakeExchangeGateway } from '../../../gateway/__fixtures__/fake-exchange-gateway'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { Hip3AbstractionState, WalletAddress } from '@/modules/shared/domain'

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
  // Non-null so the enable() path can resolve a master account.
  getMasterViemAccount: async () => ({}) as never,
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

describe('useHyperliquidHip3Abstraction() consumer hook', () => {
  it('throws when used outside Hip3AbstractionProvider', () => {
    expect(() => renderHook(() => useHyperliquidHip3Abstraction())).toThrow(
      'useHyperliquidHip3Abstraction must be used inside <Hip3AbstractionProvider>',
    )
  })

  it('returns context value when inside provider', () => {
    const contextValue: Hip3AbstractionState = {
      status: 'enabled',
      enable: () => okAsync(undefined),
    }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(Hip3AbstractionContext.Provider, { value: contextValue }, children)
    const { result } = renderHook(() => useHyperliquidHip3Abstraction(), { wrapper })
    expect(result.current.status).toBe('enabled')
  })
})

// ---------------------------------------------------------------------------
// Smart hook
// ---------------------------------------------------------------------------

describe('useOwnHip3Abstraction() smart hook', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState } as never)
    vi.mocked(useSelectedWallet).mockReturnValue({ ...defaultSelectedWallet } as never)
  })

  const SELECTED_WALLET_ADDRESS =
    '0xabcabcab00000000000000000000000000000002' as WalletAddress

  it('queries the abstraction mode for the Selected Wallet master address', async () => {
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    const querySpy = vi.fn(() => okAsync('default' as const))
    const fakeGateway = buildFakeExchangeGateway({ queryUserAbstraction: querySpy })
    renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(querySpy).toHaveBeenCalledWith(SELECTED_WALLET_ADDRESS)
  })

  it('starts in status "checking" before the bootstrap query settles', () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('default' as const),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    expect(result.current.status).toBe('checking')
  })

  it('bootstrap with "default" → status "disabled"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('default' as const),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(result.current.status).toBe('disabled')
  })

  it('bootstrap with "dexAbstraction" → status "enabled"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('dexAbstraction' as const),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(result.current.status).toBe('enabled')
  })

  it('bootstrap with "unifiedAccount" → status "enabled" (collateral already abstracted)', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('unifiedAccount' as const),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(result.current.status).toBe('enabled')
  })

  it('bootstrap failure → status error with a mapped reason', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () =>
        errAsync(new HyperliquidGatewayError('rate-limited', 'throttled')),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'rate-limited' })
  })

  it('enable() signs userDexAbstraction for the master and flips status to "enabled"', async () => {
    const enableSpy = vi.fn(() => okAsync(undefined))
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('default' as const),
      enableDexAbstraction: enableSpy,
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()
    expect(result.current.status).toBe('disabled')

    await act(async () => {
      await result.current.enable()
    })
    expect(enableSpy).toHaveBeenCalledWith(expect.anything(), mockPrimaryWalletAddress)
    expect(result.current.status).toBe('enabled')
  })

  it('enable() maps a gateway rejection to an error status', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('default' as const),
      enableDexAbstraction: () =>
        errAsync(new HyperliquidGatewayError('wallet-rejected', 'user cancelled')),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()

    await act(async () => {
      const outcome = await result.current.enable()
      expect(outcome.isErr()).toBe(true)
    })
    expect(result.current.status).toEqual({ kind: 'error', reason: 'wallet-rejected' })
  })

  it('enable() returns signing-unavailable when no master wallet is connected', async () => {
    setSelectedWallet({ masterAddress: null })
    const fakeGateway = buildFakeExchangeGateway({
      queryUserAbstraction: () => okAsync('default' as const),
    })
    const { result } = renderHook(() => useOwnHip3Abstraction(fakeGateway))
    await flush()

    await act(async () => {
      const outcome = await result.current.enable()
      expect(outcome.isErr()).toBe(true)
      if (outcome.isErr()) expect(outcome.error.reason).toBe('signing-unavailable')
    })
  })
})
