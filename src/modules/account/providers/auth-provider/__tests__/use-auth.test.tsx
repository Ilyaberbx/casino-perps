import { okAsync } from 'neverthrow'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthState } from '../auth-provider.context'
import { useAuth } from '../use-auth'
import { createApiClient } from '@/modules/shared/http'

const fixtureState: AuthState = {
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
  enrollMfa: () => okAsync(undefined),
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

function wrap(value: AuthState | null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

describe('useAuth()', () => {
  it('returns the auth context value', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(fixtureState) })
    expect(result.current.ready).toBe(true)
    expect(result.current.authenticated).toBe(true)
    expect(result.current.privyId).toBe('did:privy:abc')
    expect(typeof result.current.getAccessToken).toBe('function')
    expect(typeof result.current.logout).toBe('function')
    expect(typeof result.current.enrollMfa).toBe('function')
    expect(typeof result.current.loginWithWallet).toBe('function')
    expect(typeof result.current.openConnectModal).toBe('function')
    expect(typeof result.current.closeConnectModal).toBe('function')
    expect(result.current.isConnectModalOpen).toBe(false)
  })

  it('throws when used outside <AuthProvider>', () => {
    expect(() => renderHook(() => useAuth(), { wrapper: wrap(null) })).toThrow(
      /AuthProvider/,
    )
  })
})
