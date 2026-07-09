import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthState } from '../../providers/auth-provider/auth-provider.context'
import { createApiClient } from '@/modules/shared/http'
import { useIsWalletConnected } from '../use-is-wallet-connected'

const baseState: AuthState = {
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

function wrap(overrides: Partial<AuthState>) {
  const value = { ...baseState, ...overrides }
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

describe('useIsWalletConnected()', () => {
  it('returns true when ready, authenticated, and walletReady are all true', () => {
    const { result } = renderHook(() => useIsWalletConnected(), {
      wrapper: wrap({}),
    })
    expect(result.current).toBe(true)
  })

  it('returns false when ready is false', () => {
    const { result } = renderHook(() => useIsWalletConnected(), {
      wrapper: wrap({ ready: false }),
    })
    expect(result.current).toBe(false)
  })

  it('returns false when authenticated is false', () => {
    const { result } = renderHook(() => useIsWalletConnected(), {
      wrapper: wrap({ authenticated: false }),
    })
    expect(result.current).toBe(false)
  })

  it('returns false when walletReady is false', () => {
    const { result } = renderHook(() => useIsWalletConnected(), {
      wrapper: wrap({ walletReady: false }),
    })
    expect(result.current).toBe(false)
  })
})
