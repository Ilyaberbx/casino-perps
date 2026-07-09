import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  AuthContext,
  type AuthState,
} from '../../providers/auth-provider/auth-provider.context'
import { OnboardingFlowContext } from '../../providers/onboarding-flow-provider'
import type { OnboardingState } from '../onboarding-flow.types'
import type { Me } from '../../domain/types'
import { useSelectedWallet } from '../use-selected-wallet'
import { createApiClient } from '@/modules/shared/http'
import { parseWalletAddress } from '@/modules/shared/domain'

const NATIVE = '0xaaaa000000000000000000000000000000000001'
const SELECTED_EXTERNAL = '0xbbbb000000000000000000000000000000000002'

function makeMe(selectedAddress: string): Me {
  return {
    user: { privyId: 'did:privy:abc', email: 'a@b.co', handle: 'abc', iconUrl: null },
    wallets: [
      { chain: 'evm', address: NATIVE, isSelected: selectedAddress === NATIVE, source: 'embedded' },
      {
        chain: 'evm',
        address: SELECTED_EXTERNAL,
        isSelected: selectedAddress === SELECTED_EXTERNAL,
        source: 'external',
      },
    ],
  }
}

function baseAuth(connectable: string[]): AuthState {
  return {
    ready: true,
    authenticated: true,
    privyId: 'did:privy:abc',
    walletAddress: NATIVE,
    primaryWalletAddress: parseWalletAddress(NATIVE)._unsafeUnwrap(),
    walletSource: 'embedded',
    walletReady: true,
    isBroadcastWalletReady: connectable.length > 0,
    connectableMasterAddresses: connectable,
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
}

function wrap(auth: AuthState, flow: OnboardingState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>
      <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
    </AuthContext.Provider>
  )
}

describe('useSelectedWallet', () => {
  it('resolves the master to the Selected Wallet when it is a live connectable external wallet', () => {
    const auth = baseAuth([SELECTED_EXTERNAL.toLowerCase()])
    const flow: OnboardingState = { kind: 'ready', me: makeMe(SELECTED_EXTERNAL) }
    const { result } = renderHook(() => useSelectedWallet(), { wrapper: wrap(auth, flow) })
    expect(result.current.selectedAddress).toBe(SELECTED_EXTERNAL)
    expect(result.current.masterAddress).toBe(SELECTED_EXTERNAL)
    expect(result.current.isSelectionConnectable).toBe(true)
    // The Native (embedded) wallet is the account-stable identity (ADR-0061),
    // independent of which wallet is selected.
    expect(result.current.nativeAddress).toBe(NATIVE)
  })

  it('non-connectable stored selection: master null (never silently Native), native still resolved', () => {
    // Selected the external wallet on another device; it is not in the live session here.
    const auth = baseAuth([])
    const flow: OnboardingState = { kind: 'ready', me: makeMe(SELECTED_EXTERNAL) }
    const { result } = renderHook(() => useSelectedWallet(), { wrapper: wrap(auth, flow) })
    expect(result.current.selectedAddress).toBe(SELECTED_EXTERNAL)
    expect(result.current.isSelectionConnectable).toBe(false)
    // ADR-0061 / Fix 3: master resolves to null (connect-to-grant), NOT the Native
    // fallback — but `nativeAddress` is still the account identity for the agent key.
    expect(result.current.masterAddress).toBeNull()
    expect(result.current.nativeAddress).toBe(NATIVE)
  })

  it('returns nulls before Me resolves (flow not ready)', () => {
    const auth = baseAuth([])
    const { result } = renderHook(() => useSelectedWallet(), {
      wrapper: wrap(auth, { kind: 'resolving' }),
    })
    expect(result.current.selectedAddress).toBeNull()
  })

  it('reflects a refreshed/applied Me — the new is_selected becomes the selected wallet', () => {
    // Model the canonical single source of truth: a `ready` flow whose `applyMe`
    // updates `me`. A refreshMe / select that returns a Me with a different
    // is_selected must move `useSelectedWallet`'s selectedAddress.
    const auth = baseAuth([NATIVE.toLowerCase(), SELECTED_EXTERNAL.toLowerCase()])
    let applyMeExternal: (me: Me) => void = () => {}
    function LiveWrap({ children }: { children: ReactNode }) {
      const [me, setMe] = useState<Me>(makeMe(NATIVE))
      applyMeExternal = setMe
      const flow = { kind: 'ready' as const, me, applyMe: setMe, refreshMe: () => okAsync(me) }
      return (
        <AuthContext.Provider value={auth}>
          <OnboardingFlowContext.Provider value={flow}>{children}</OnboardingFlowContext.Provider>
        </AuthContext.Provider>
      )
    }

    const { result } = renderHook(() => useSelectedWallet(), { wrapper: LiveWrap })
    expect(result.current.selectedAddress).toBe(NATIVE)

    act(() => applyMeExternal(makeMe(SELECTED_EXTERNAL)))
    expect(result.current.selectedAddress).toBe(SELECTED_EXTERNAL)
    expect(result.current.masterAddress).toBe(SELECTED_EXTERNAL)
  })
})
