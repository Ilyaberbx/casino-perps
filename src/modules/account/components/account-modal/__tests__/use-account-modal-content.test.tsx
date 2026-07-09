import { okAsync } from 'neverthrow'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { OnboardingFlowContext } from '../../../providers/onboarding-flow-provider/onboarding-flow-provider.context'
import { AccountModalContext } from '../../../providers/account-modal-provider'
import { AuthContext, type AuthState } from '../../../providers/auth-provider/auth-provider.context'
import type { OnboardingState } from '../../../hooks/onboarding-flow.types'
import type { Me } from '../../../domain/types'
import { useAccountModalContent } from '../use-account-modal-content'
import { createApiClient } from '@/modules/shared/http'

const NATIVE = '0xaaaa000000000000000000000000000000000001'

function makeMe(): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [{ chain: 'evm', address: NATIVE, isSelected: true, source: 'embedded' }],
  }
}

// `useOnboardingFlow` always calls `useOwnOnboardingFlow` (hook rules), which
// reads `useAuth()` — so an `AuthContext` must be present even when the flow
// itself comes from context.
const authState: AuthState = {
  ready: true,
  authenticated: true,
  privyId: 'did:privy:abc',
  walletAddress: NATIVE,
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
  linkWallet: () => okAsync('0x0000000000000000000000000000000000000000'),
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

// A test harness exposing `setOpen` so a test can drive the closed→open
// transition that fires `refreshMe`.
let setOpenExternal: (open: boolean) => void = () => {}

function harness(flow: OnboardingState, initialOpen: boolean) {
  return ({ children }: { children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(initialOpen)
    setOpenExternal = setIsOpen
    return (
      <AuthContext.Provider value={authState}>
        <OnboardingFlowContext.Provider value={flow}>
          <AccountModalContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
            {children}
          </AccountModalContext.Provider>
        </OnboardingFlowContext.Provider>
      </AuthContext.Provider>
    )
  }
}

describe('useAccountModalContent — refetch on open', () => {
  it('calls refreshMe once when the modal transitions closed → open', () => {
    const refreshMe = vi.fn(() => okAsync<Me, never>(makeMe()))
    const flow: OnboardingState = { kind: 'ready', me: makeMe(), applyMe: () => {}, refreshMe }

    renderHook(() => useAccountModalContent(), { wrapper: harness(flow, false) })
    expect(refreshMe).not.toHaveBeenCalled()

    act(() => setOpenExternal(true))
    expect(refreshMe).toHaveBeenCalledTimes(1)
  })

  it('does not refetch again while the modal stays open, and refetches on a re-open', () => {
    const refreshMe = vi.fn(() => okAsync<Me, never>(makeMe()))
    const flow: OnboardingState = { kind: 'ready', me: makeMe(), applyMe: () => {}, refreshMe }

    renderHook(() => useAccountModalContent(), { wrapper: harness(flow, true) })
    // Mounted already-open is the first open transition.
    expect(refreshMe).toHaveBeenCalledTimes(1)

    act(() => setOpenExternal(false))
    expect(refreshMe).toHaveBeenCalledTimes(1)

    act(() => setOpenExternal(true))
    expect(refreshMe).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the flow is not ready (no refreshMe available)', () => {
    const flow: OnboardingState = { kind: 'resolving' }
    const { result } = renderHook(() => useAccountModalContent(), {
      wrapper: harness(flow, true),
    })
    expect(result.current.isOpen).toBe(true)
  })
})
