import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthContext, type AuthState } from '../auth-provider.context'
import { useAuth } from '../use-auth'
import { createApiClient } from '@/modules/shared/http'
import { okAsync } from 'neverthrow'
import type { WalletAddress } from '@/modules/shared/domain'

// This test validates that AuthState.getMasterViemAccount is present and callable.
// It uses the context directly (no PrivyProvider needed) so it can test the interface contract.

// ADR-0060: the accessor now TAKES the resolved Selected-Wallet master address.
const MASTER = '0xaaaa000000000000000000000000000000000001' as WalletAddress
const EMBEDDED_MASTER = '0xcccc000000000000000000000000000000000003' as WalletAddress

const fakeMasterViemAccount = {
  signTypedData: () => Promise.resolve('0xdeadbeef' as `0x${string}`),
  address: '0xaaaa000000000000000000000000000000000001' as `0x${string}`,
  type: 'local' as const,
}

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

function wrap(value: AuthState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

describe('getMasterViemAccount on AuthState (Option A — ADR-0012)', () => {
  it('AuthState exposes getMasterViemAccount as a function', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(baseState) })
    expect(typeof result.current.getMasterViemAccount).toBe('function')
  })

  it('returns null when implementation returns null (master not resolvable yet)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(baseState) })
    const account = await result.current.getMasterViemAccount(MASTER)
    expect(account).toBeNull()
  })

  it('returns the viem account when implementation resolves one', async () => {
    const stateWithAccount: AuthState = {
      ...baseState,
      getMasterViemAccount: async () => fakeMasterViemAccount as never,
    }
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(stateWithAccount) })
    const account = await result.current.getMasterViemAccount(MASTER)
    expect(account).toBe(fakeMasterViemAccount)
  })

  // --- Selected-Wallet signing contract (ADR-0060) ---
  // These tests verify the CONTRACT that getMasterViemAccount resolves the wallet
  // matching the passed master address — external OR embedded. The actual
  // Privy/viem glue lives in AuthBridge (integration tested via live
  // PrivyProvider); what we can unit-test here is that conforming implementations
  // receive the master address and resolve a client for it.

  it('receives the target master address and resolves a client for the EMBEDDED selected wallet (ADR-0060)', async () => {
    // Simulates: an email-only user whose Selected Wallet is the embedded Native
    // wallet. ADR-0060: the embedded wallet is now a valid signing master —
    // getMasterViemAccount resolves a client (no longer null) and signing does
    // NOT abort `signing-unavailable`.
    const embeddedAccount = {
      signTypedData: () => Promise.resolve('0xembedded' as `0x${string}`),
      address: EMBEDDED_MASTER as `0x${string}`,
      type: 'local' as const,
    }
    let receivedMaster: WalletAddress | null = null
    const stateEmbedded: AuthState = {
      ...baseState,
      walletSource: 'embedded',
      getMasterViemAccount: async (master) => {
        receivedMaster = master
        return embeddedAccount as never
      },
    }
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(stateEmbedded) })
    const account = await result.current.getMasterViemAccount(EMBEDDED_MASTER)
    expect(receivedMaster).toBe(EMBEDDED_MASTER)
    expect(account).toBe(embeddedAccount)
  })

  it('resolves the viem account for an external wallet matching the master address', async () => {
    // Simulates: user logged in with MetaMask — external wallet is the master.
    const externalAccount = {
      signTypedData: () => Promise.resolve('0xsigned' as `0x${string}`),
      address: '0xbbbb000000000000000000000000000000000002' as `0x${string}`,
      type: 'local' as const,
    }
    const externalMaster = '0xbbbb000000000000000000000000000000000002' as WalletAddress
    const stateExternal: AuthState = {
      ...baseState,
      walletSource: 'external',
      walletAddress: externalMaster,
      getMasterViemAccount: async () => externalAccount as never,
    }
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(stateExternal) })
    const account = await result.current.getMasterViemAccount(externalMaster)
    expect(account).toBe(externalAccount)
  })

  it('returns null when no connected wallet matches the master address (still hydrating)', async () => {
    // A still-rehydrating injected wallet or an unconnectable selection: the
    // accessor returns null and the consumer surfaces signing-unavailable.
    const stateNoMatch: AuthState = {
      ...baseState,
      getMasterViemAccount: async () => null,
      getBroadcastWalletClient: async () => null,
      getAgentWalletBroadcastClient: async () => null,
      switchMasterWalletChain: async () => 'switched',
      createAgentWallet: async () => ({ address: '0x0000000000000000000000000000000000000000', walletId: 'w' }),
      attachAgentSigner: async () => true,
      removeAgentSigner: async () => true,
    }
    const { result } = renderHook(() => useAuth(), { wrapper: wrap(stateNoMatch) })
    const got = await result.current.getMasterViemAccount(MASTER)
    expect(got).toBeNull()
  })
})
