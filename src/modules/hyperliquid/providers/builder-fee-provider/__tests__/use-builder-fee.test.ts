import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { errAsync, okAsync } from 'neverthrow'
import { BuilderFeeContext, type BuilderFeeState } from '../builder-fee-provider.context'
import { useBuilderFee, useOwnBuilderFee } from '../use-builder-fee'
import { buildFakeExchangeGateway } from '../../../gateway/__fixtures__/fake-exchange-gateway'
import { HyperliquidGatewayError } from '../../../gateway/hyperliquid-gateway.types'
import type { WalletAddress } from '@/modules/shared/domain'
import { HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS } from '../../../hyperliquid.constants'

// ---------------------------------------------------------------------------
// Mock @/modules/account — same shape as the agent-wallet tests
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

// The Selected Wallet → master seam (slice 07). Builder-fee keys on this
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

describe('useBuilderFee() consumer hook', () => {
  it('throws when used outside BuilderFeeProvider', () => {
    expect(() => renderHook(() => useBuilderFee())).toThrow(
      'useBuilderFee must be used inside <BuilderFeeProvider>',
    )
  })

  it('returns context value when inside provider', () => {
    const contextValue: BuilderFeeState = {
      status: 'approved',
      approvedBuilders: null,
      approve: () => okAsync(undefined),
      replaceBuilder: () => okAsync(undefined),
    }
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(BuilderFeeContext.Provider, { value: contextValue }, children)
    const { result } = renderHook(() => useBuilderFee(), { wrapper })
    expect(result.current.status).toBe('approved')
  })
})

// ---------------------------------------------------------------------------
// Smart hook
// ---------------------------------------------------------------------------

describe('useOwnBuilderFee() smart hook', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ ...defaultAuthState } as never)
    vi.mocked(useSelectedWallet).mockReturnValue({ ...defaultSelectedWallet } as never)
  })

  // Slice 07: builder-fee keys on the Selected Wallet master address.
  const SELECTED_WALLET_ADDRESS =
    '0xabcabcab00000000000000000000000000000002' as WalletAddress

  it('queries the builder fee for the Selected Wallet master address (not the Primary)', async () => {
    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    const querySpy = vi.fn(() => okAsync(0))
    const fakeGateway = buildFakeExchangeGateway({ queryMaxBuilderFee: querySpy })
    renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(querySpy).toHaveBeenCalledWith(SELECTED_WALLET_ADDRESS)
  })

  it('re-queries the builder fee for the new master when the Selected Wallet switches', async () => {
    const querySpy = vi.fn(() => okAsync(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS))
    const fakeGateway = buildFakeExchangeGateway({ queryMaxBuilderFee: querySpy })
    const { rerender } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(querySpy).toHaveBeenCalledWith(mockPrimaryWalletAddress)

    setSelectedWallet({ masterAddress: SELECTED_WALLET_ADDRESS })
    rerender()
    await flush()
    expect(querySpy).toHaveBeenCalledWith(SELECTED_WALLET_ADDRESS)
  })

  it('starts in status "checking" before the bootstrap query settles', () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    expect(result.current.status).toBe('checking')
  })

  it('bootstrap with approved rate >= required → status "approved"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toBe('approved')
  })

  it('bootstrap with approved rate > required → status "approved"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS + 100),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toBe('approved')
  })

  it('bootstrap with approved rate < required → status "missing" (stale → re-prompt)', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(HYPERLIQUID_BUILDER_FEE_TENTHS_OF_BPS - 1),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toBe('missing')
  })

  it('bootstrap with rate 0 → status "missing"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toBe('missing')
  })

  it('bootstrap failure → status error with reason "bootstrap-failed"', async () => {
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('network', 'query failed')),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'unknown' })
  })

  it('approve() without a master wallet → signing-unavailable, no gateway call', async () => {
    setAuthState({
      getMasterViemAccount: async () => null,
  getBroadcastWalletClient: async () => null,
  createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
  attachAgentSigner: async () => true,
  removeAgentSigner: async () => true,
    })
    const approveSpy = vi.fn(() => okAsync(undefined))
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: approveSpy,
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    let r: Awaited<ReturnType<typeof result.current.approve>> | undefined
    await act(async () => {
      r = await result.current.approve()
    })
    expect(r?.isErr()).toBe(true)
    if (r?.isErr()) expect(r.error.kind).toBe('signing-unavailable')
    expect(approveSpy).not.toHaveBeenCalled()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'signing-unavailable' })
  })

  it('approve() success → status transitions missing → approving → approved', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: () => okAsync(undefined),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(result.current.status).toBe('missing')

    await act(async () => {
      await result.current.approve()
    })
    expect(result.current.status).toBe('approved')
  })

  it('approve() gateway failure → status error with reason "approval-failed"', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('network', 'signing failed')),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    let approveResult: Awaited<ReturnType<typeof result.current.approve>> | undefined
    await act(async () => {
      approveResult = await result.current.approve()
    })
    expect(approveResult?.isErr()).toBe(true)
    if (approveResult?.isErr()) expect(approveResult.error.kind).toBe('unknown')
    expect(result.current.status).toEqual({ kind: 'error', reason: 'unknown' })
  })

  it('does not bootstrap when not connected', async () => {
    setAuthState({ ready: false })
    const querySpy = vi.fn(() => okAsync(35))
    const fakeGateway = buildFakeExchangeGateway({ queryMaxBuilderFee: querySpy })
    renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    expect(querySpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Phase 07 Plan 01 — deposit-required threading through builder provider (DEP-02)
  // -------------------------------------------------------------------------

  it('approve() deposit-required gateway failure → status error with reason "deposit-required"', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('deposit-required', 'Deposit required')),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    let approveResult: Awaited<ReturnType<typeof result.current.approve>> | undefined
    await act(async () => {
      approveResult = await result.current.approve()
    })
    expect(approveResult?.isErr()).toBe(true)
    if (approveResult?.isErr()) expect(approveResult.error.kind).toBe('deposit-required')
    expect(result.current.status).toEqual({ kind: 'error', reason: 'deposit-required' })
  })

  // -------------------------------------------------------------------------
  // ADR-0036 D-4 — builder-cap recovery (revoke picker + replaceBuilder chain)
  // -------------------------------------------------------------------------

  const OWN_BUILDER = '0xff9be883a670afe4c1e8dcb2fc05afb2caecd6b7' as WalletAddress
  const FOREIGN_BUILDER_A = '0x1111111111111111111111111111111111111111' as WalletAddress
  const FOREIGN_BUILDER_B = '0x2222222222222222222222222222222222222222' as WalletAddress

  it('approve() cap rejection → fetches approvedBuilders into state, with our own builder filtered out', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('approval-cap-reached', 'max approvals')),
      queryApprovedBuilders: () =>
        okAsync<ReadonlyArray<WalletAddress>, HyperliquidGatewayError>([
          FOREIGN_BUILDER_A,
          OWN_BUILDER,
          FOREIGN_BUILDER_B,
        ]),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    await act(async () => {
      await result.current.approve()
    })
    await flush()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'approval-cap-reached' })
    expect(result.current.approvedBuilders).toEqual([FOREIGN_BUILDER_A, FOREIGN_BUILDER_B])
  })

  it('replaceBuilder() chains revoke(victim) then approve(ours) and lands on approved', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const calls: string[] = []
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      revokeBuilderFee: (_wallet, victim) => {
        calls.push(`revoke:${victim}`)
        return okAsync(undefined)
      },
      approveBuilderFee: () => {
        calls.push('approve')
        return okAsync(undefined)
      },
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    await act(async () => {
      await result.current.replaceBuilder(FOREIGN_BUILDER_A)
    })
    expect(calls).toEqual([`revoke:${FOREIGN_BUILDER_A}`, 'approve'])
    expect(result.current.status).toBe('approved')
  })

  it('replaceBuilder() does NOT run the approve leg when the revoke leg fails', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const approveSpy = vi.fn(() => okAsync(undefined))
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      revokeBuilderFee: () => errAsync(new HyperliquidGatewayError('network', 'revoke failed')),
      approveBuilderFee: approveSpy,
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    let replaceResult: Awaited<ReturnType<typeof result.current.replaceBuilder>> | undefined
    await act(async () => {
      replaceResult = await result.current.replaceBuilder(FOREIGN_BUILDER_A)
    })
    expect(replaceResult?.isErr()).toBe(true)
    expect(approveSpy).not.toHaveBeenCalled()
    expect(result.current.status).toEqual({ kind: 'error', reason: 'unknown' })
  })

  it('replaceBuilder() surfaces a second-leg failure as a plain error (slot already freed — retry completes)', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      revokeBuilderFee: () => okAsync(undefined),
      approveBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('rate-limited', 'slow down')),
    })
    const { result } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    let replaceResult: Awaited<ReturnType<typeof result.current.replaceBuilder>> | undefined
    await act(async () => {
      replaceResult = await result.current.replaceBuilder(FOREIGN_BUILDER_A)
    })
    expect(replaceResult?.isErr()).toBe(true)
    expect(result.current.status).toEqual({ kind: 'error', reason: 'rate-limited' })
  })

  it('resets approvedBuilders to null on wallet disconnect', async () => {
    setAuthState({
      getMasterViemAccount: async () => ({} as never),
    })
    const fakeGateway = buildFakeExchangeGateway({
      queryMaxBuilderFee: () => okAsync(0),
      approveBuilderFee: () =>
        errAsync(new HyperliquidGatewayError('approval-cap-reached', 'max approvals')),
      queryApprovedBuilders: () =>
        okAsync<ReadonlyArray<WalletAddress>, HyperliquidGatewayError>([FOREIGN_BUILDER_A]),
    })
    const { result, rerender } = renderHook(() => useOwnBuilderFee(fakeGateway))
    await flush()
    await act(async () => {
      await result.current.approve()
    })
    await flush()
    expect(result.current.approvedBuilders).toEqual([FOREIGN_BUILDER_A])

    setAuthState({ ready: false, authenticated: false, walletReady: false })
    rerender()
    await flush()
    expect(result.current.approvedBuilders).toBeNull()
  })
})
